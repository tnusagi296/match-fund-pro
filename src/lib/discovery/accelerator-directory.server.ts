import type {
  GraphClaimInput,
  GraphEntityInput,
  GraphIngestionResult,
  GraphRelationshipInput,
} from "@/lib/graph/types";
import type { Thesis } from "@/lib/thesis";
import {
  asJson,
  founderEntity,
  graphEvidence,
  identifierForUrl,
  slug,
  websiteEntity,
} from "./graph-builders.server";
import { DiscoveryPlanner } from "./planner.server";
import { fetchPublicHtml } from "./safe-fetch.server";
import type { DirectorySourceConfiguration } from "./source-registry.server";
import {
  anchors,
  attribute,
  canonicalDomainUrl,
  canonicalHttpsUrl,
  jsonLdObjects,
  metaContent,
  pageTitle,
  visibleText,
} from "./source-utils.server";
import { DISCOVERY_LIMITS } from "./types";
import type {
  DiscoveryAdapter,
  DiscoveryReason,
  DiscoveryResult,
  PublicDiscoveryCandidate,
  SourceDiscoveryIssue,
  SourceDiscoveryPlan,
} from "./types";

type AcceleratorDirectoryAdapterOptions = {
  configurations: DirectorySourceConfiguration[];
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type ExplicitFounder = {
  name: string;
  role: string;
  url: string;
  identifier: NonNullable<ReturnType<typeof identifierForUrl>>;
};

function dataAttribute(html: string, name: string): string | null {
  const match = html.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2]?.trim() || null;
}

function explicitFounders(html: string, baseUrl: string): ExplicitFounder[] {
  const founders: ExplicitFounder[] = [];
  for (const anchor of anchors(html, baseUrl)) {
    const name = attribute(anchor.attributes, "data-founder-name");
    const role = attribute(anchor.attributes, "data-role") ?? "";
    if (!name || !/\b(?:co-?founder|founder)\b/i.test(role)) continue;
    const identifier = identifierForUrl(anchor.href);
    if (!identifier) continue;
    founders.push({ name, role, url: identifier.value, identifier });
  }
  for (const item of jsonLdObjects(html)) {
    if (item["@type"] !== "Organization") continue;
    const values = Array.isArray(item.founder) ? item.founder : item.founder ? [item.founder] : [];
    for (const value of values) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const person = value as Record<string, unknown>;
      const name = typeof person.name === "string" ? person.name.trim() : "";
      const urls = [person.url, ...(Array.isArray(person.sameAs) ? person.sameAs : [])].filter(
        (url): url is string => typeof url === "string",
      );
      const identifier = urls.map(identifierForUrl).find(Boolean);
      if (name && identifier)
        founders.push({ name, role: "Founder", url: identifier.value, identifier });
    }
  }
  return [
    ...new Map(
      founders.map((founder) => [
        `${founder.identifier.scheme}:${founder.identifier.value}`,
        founder,
      ]),
    ).values(),
  ];
}

function issue(sourceName: string, message: string): SourceDiscoveryIssue {
  return {
    source: "accelerator",
    query: sourceName,
    status: null,
    message,
    rateLimited: false,
    rateLimitResetAt: null,
  };
}

function candidateUrls(founder: ExplicitFounder) {
  return {
    github:
      founder.identifier.scheme === "github_login"
        ? `https://github.com/${founder.identifier.value}`
        : null,
    personalWebsite:
      founder.identifier.scheme === "personal_website_url" ? founder.identifier.value : null,
    linkedin: founder.identifier.scheme === "linkedin_url" ? founder.identifier.value : null,
    reddit: founder.identifier.scheme === "reddit_url" ? founder.identifier.value : null,
  };
}

function companyGraph(input: {
  configuration: DirectorySourceConfiguration;
  companyUrl: string;
  html: string;
  founder: ExplicitFounder;
  retrievedAt: string;
}): GraphIngestionResult {
  const { configuration, companyUrl, html, founder, retrievedAt } = input;
  const title = pageTitle(html) ?? configuration.name;
  const companyName =
    dataAttribute(html, "data-company-name") ?? metaContent(html, "og:title") ?? title;
  const cohort = dataAttribute(html, "data-cohort") ?? "Cohort unknown";
  const acceleratorName = dataAttribute(html, "data-accelerator") ?? configuration.name;
  const sector = dataAttribute(html, "data-sector");
  const location = dataAttribute(html, "data-location");
  const companyWebsiteRaw =
    dataAttribute(html, "data-company-website") ??
    anchors(html, companyUrl).find((anchor) =>
      /\bdata-company-website(?:\s|=)/i.test(anchor.attributes),
    )?.href ??
    null;
  const companyWebsite = companyWebsiteRaw ? canonicalDomainUrl(companyWebsiteRaw) : null;
  const excerpt = visibleText(html).slice(0, 1200);
  const evidenceTempId = `evidence:accelerator:${slug(configuration.id)}:${slug(companyUrl)}`;
  const founderTempId = `founder:accelerator:${slug(founder.identifier.value)}`;
  const companyTempId = `company:accelerator:${slug(companyWebsite ?? companyUrl)}`;
  const cohortTempId = `cohort:${slug(configuration.id)}:${slug(cohort)}`;
  const acceleratorTempId = `accelerator:${slug(configuration.id)}`;
  const entities: GraphEntityInput[] = [
    founderEntity(founderTempId, founder.name, [founder.identifier], {
      ...candidateUrls(founder),
      acceleratorRole: founder.role,
    }),
    {
      tempId: companyTempId,
      entityType: "company",
      canonicalKey: `accelerator-company:${slug(companyWebsite ?? companyUrl)}`,
      canonicalName: companyName,
      properties: asJson({
        sector,
        location,
        website: companyWebsite,
        accelerator: acceleratorName,
        cohort,
      }),
      identifiers: [
        { scheme: "accelerator_company_url", value: companyUrl },
        ...(companyWebsite
          ? ([
              { scheme: "company_website_url", value: companyWebsite },
              { scheme: "company_domain", value: new URL(companyWebsite).hostname },
            ] satisfies GraphEntityInput["identifiers"])
          : []),
      ],
    },
    {
      tempId: cohortTempId,
      entityType: "accelerator_cohort",
      canonicalKey: `accelerator-cohort:${slug(configuration.id)}:${slug(cohort)}`,
      canonicalName: `${acceleratorName} ${cohort}`,
      properties: { cohort, accelerator: acceleratorName, directoryUrl: configuration.indexUrl },
      identifiers: [
        { scheme: "source_external_id", value: `${configuration.id}:cohort:${cohort}` },
      ],
    },
    {
      tempId: acceleratorTempId,
      entityType: "accelerator",
      canonicalKey: `accelerator:${slug(configuration.id)}`,
      canonicalName: acceleratorName,
      properties: { directoryUrl: configuration.indexUrl },
      identifiers: [{ scheme: "canonical_url", value: configuration.indexUrl }],
    },
  ];
  const website = companyWebsite
    ? websiteEntity(
        `website:company:${slug(companyWebsite)}`,
        companyWebsite,
        `${companyName} website`,
        "company",
      )
    : null;
  if (website) entities.push(website);
  if (sector) {
    entities.push({
      tempId: `sector:${slug(sector)}`,
      entityType: "sector",
      canonicalKey: `sector:${slug(sector)}`,
      canonicalName: sector,
      properties: {},
      identifiers: [],
    });
  }
  const relationships: GraphRelationshipInput[] = [
    {
      tempId: `relationship:${founderTempId}:FOUNDED:${companyTempId}`,
      sourceTempId: founderTempId,
      targetTempId: companyTempId,
      relationshipType: "FOUNDED",
      confidence: 0.95,
      observedAt: retrievedAt,
      validFrom: null,
      validTo: null,
      properties: { role: founder.role, verificationStatus: "supported" },
      evidenceTempIds: [evidenceTempId],
    },
    {
      tempId: `relationship:${companyTempId}:PARTICIPATED_IN:${cohortTempId}`,
      sourceTempId: companyTempId,
      targetTempId: cohortTempId,
      relationshipType: "PARTICIPATED_IN",
      confidence: 0.95,
      observedAt: retrievedAt,
      validFrom: null,
      validTo: null,
      properties: { cohort, verificationStatus: "supported" },
      evidenceTempIds: [evidenceTempId],
    },
    {
      tempId: `relationship:${companyTempId}:ACCELERATED_BY:${acceleratorTempId}`,
      sourceTempId: companyTempId,
      targetTempId: acceleratorTempId,
      relationshipType: "ACCELERATED_BY",
      confidence: 0.95,
      observedAt: retrievedAt,
      validFrom: null,
      validTo: null,
      properties: { cohort, verificationStatus: "supported" },
      evidenceTempIds: [evidenceTempId],
    },
    {
      tempId: `relationship:${cohortTempId}:OPERATED_BY:${acceleratorTempId}`,
      sourceTempId: cohortTempId,
      targetTempId: acceleratorTempId,
      relationshipType: "OPERATED_BY",
      confidence: 0.98,
      observedAt: retrievedAt,
      validFrom: null,
      validTo: null,
      properties: { verificationStatus: "supported" },
      evidenceTempIds: [evidenceTempId],
    },
  ];
  if (website) {
    relationships.push({
      tempId: `relationship:${companyTempId}:HAS_WEBSITE:${website.tempId}`,
      sourceTempId: companyTempId,
      targetTempId: website.tempId,
      relationshipType: "HAS_WEBSITE",
      confidence: 0.95,
      observedAt: retrievedAt,
      validFrom: null,
      validTo: null,
      properties: { verificationStatus: "supported" },
      evidenceTempIds: [evidenceTempId],
    });
  }
  if (sector) {
    relationships.push({
      tempId: `relationship:${companyTempId}:FOCUSES_ON:sector:${slug(sector)}`,
      sourceTempId: companyTempId,
      targetTempId: `sector:${slug(sector)}`,
      relationshipType: "FOCUSES_ON",
      confidence: 0.9,
      observedAt: retrievedAt,
      validFrom: null,
      validTo: null,
      properties: { verificationStatus: "supported" },
      evidenceTempIds: [evidenceTempId],
    });
  }
  const claims: GraphClaimInput[] = [
    {
      tempId: `claim:${founderTempId}:founded:${slug(companyName)}`,
      subjectTempId: founderTempId,
      predicate: "founded_company",
      value: { company: companyName, role: founder.role },
      status: "supported",
      trustLevel: "high",
      observedAt: retrievedAt,
      evidenceTempIds: [evidenceTempId],
    },
    {
      tempId: `claim:${companyTempId}:accelerator:${slug(cohort)}`,
      subjectTempId: companyTempId,
      predicate: "accelerator_participation",
      value: { accelerator: acceleratorName, cohort },
      status: "supported",
      trustLevel: "high",
      observedAt: retrievedAt,
      evidenceTempIds: [evidenceTempId],
    },
  ];
  if (location) {
    claims.push({
      tempId: `claim:${companyTempId}:location`,
      subjectTempId: companyTempId,
      predicate: "company_location",
      value: location,
      status: "supported",
      trustLevel: "high",
      observedAt: retrievedAt,
      evidenceTempIds: [evidenceTempId],
    });
  }
  return {
    entities,
    relationships,
    claims,
    evidence: [
      graphEvidence({
        tempId: evidenceTempId,
        sourceType: "accelerator_cohort_page",
        sourceUrl: companyUrl,
        sourceExternalId: `${configuration.id}:${companyName}:${cohort}`,
        retrievedAt,
        excerpt,
        rawPayload: {
          companyName,
          founder: founder.name,
          role: founder.role,
          cohort,
          sector,
          location,
        },
        reliability: 0.95,
        pageTitle: title,
        extractionMethod: "configured_accelerator_directory_html",
        trustLevel: "high",
        sourceName: configuration.name,
      }),
    ],
  };
}

export class AcceleratorDirectoryAdapter implements DiscoveryAdapter {
  private readonly fetchImpl?: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly options: AcceleratorDirectoryAdapterOptions) {
    this.fetchImpl = options.fetchImpl;
    this.now = options.now ?? (() => new Date());
  }

  async plan(thesis: Thesis): Promise<SourceDiscoveryPlan> {
    const plan = new DiscoveryPlanner()
      .plan(thesis)
      .sources.find((item) => item.source === "accelerator");
    if (!plan) throw new Error("Accelerator discovery plan was not generated.");
    return plan;
  }

  async discover(plan: SourceDiscoveryPlan): Promise<DiscoveryResult> {
    if (plan.source !== "accelerator")
      throw new Error("Accelerator adapter received the wrong plan.");
    if (this.options.configurations.length === 0) {
      return {
        source: "accelerator",
        status: "disabled_unconfigured",
        candidates: [],
        queriesExecuted: 0,
        recordsEvaluated: 0,
        skipped: 0,
        issues: [issue("accelerator", "No configured accelerator directory is available.")],
      };
    }
    const candidates = new Map<string, PublicDiscoveryCandidate>();
    const issues: SourceDiscoveryIssue[] = [];
    let queriesExecuted = 0;
    let recordsEvaluated = 0;
    let skipped = 0;
    for (const configuration of this.options.configurations.slice(
      0,
      DISCOVERY_LIMITS.maxAcceleratorDirectories,
    )) {
      let pattern: RegExp;
      try {
        pattern = new RegExp(configuration.itemUrlPattern, "i");
      } catch {
        issues.push(issue(configuration.name, "Configured company URL pattern is invalid."));
        continue;
      }
      let indexHtml: string;
      try {
        indexHtml = (await fetchPublicHtml(configuration.indexUrl, { fetchImpl: this.fetchImpl }))
          .html;
        queriesExecuted += 1;
      } catch (error) {
        issues.push(
          issue(
            configuration.name,
            error instanceof Error ? error.message : "Directory fetch failed.",
          ),
        );
        continue;
      }
      const companyUrls = [
        ...new Set(
          anchors(indexHtml, configuration.indexUrl)
            .filter((anchor) => pattern.test(new URL(anchor.href).pathname))
            .map((anchor) => canonicalHttpsUrl(anchor.href))
            .filter((url): url is string => Boolean(url)),
        ),
      ].slice(0, DISCOVERY_LIMITS.maxAcceleratorCompanies);
      for (const companyUrl of companyUrls) {
        let html: string;
        try {
          html = (await fetchPublicHtml(companyUrl, { fetchImpl: this.fetchImpl })).html;
        } catch (error) {
          issues.push(
            issue(
              configuration.name,
              error instanceof Error ? error.message : "Company fetch failed.",
            ),
          );
          continue;
        }
        recordsEvaluated += 1;
        const text = visibleText(html);
        const matchingQueries = plan.queries.filter((query) =>
          text.toLowerCase().includes(query.query.toLowerCase()),
        );
        if (plan.queries.length > 0 && matchingQueries.length === 0) {
          skipped += 1;
          continue;
        }
        const founders = explicitFounders(html, companyUrl);
        if (founders.length === 0) {
          skipped += 1;
          continue;
        }
        const retrievedAt = this.now().toISOString();
        for (const founder of founders) {
          const graph = companyGraph({ configuration, companyUrl, html, founder, retrievedAt });
          const identifier = `${founder.identifier.scheme}:${founder.identifier.value}`;
          const companyName =
            dataAttribute(html, "data-company-name") ?? pageTitle(html) ?? "Company";
          const reasons: DiscoveryReason[] = (
            matchingQueries.length > 0 ? matchingQueries : plan.queries.slice(0, 1)
          ).map((query) => ({
            source: "accelerator",
            query: query.query,
            planReason: query.reason,
            sourceName: configuration.name,
            resultName: companyName,
            resultUrl: companyUrl,
          }));
          candidates.set(identifier, {
            source: "accelerator",
            sourceIdentifier: identifier,
            displayName: founder.name,
            sourceUrl: companyUrl,
            explicitFounderRole: true,
            identifiers: [founder.identifier],
            urls: {
              ...candidateUrls(founder),
              companyWebsite: dataAttribute(html, "data-company-website"),
            },
            discoveryReasons: reasons,
            graph,
            context: asJson({ directoryId: configuration.id, companyName, role: founder.role }),
          });
        }
      }
    }
    const values = [...candidates.values()].slice(0, DISCOVERY_LIMITS.maxCandidates);
    return {
      source: "accelerator",
      status: issues.length > 0 ? (values.length > 0 ? "partial" : "failed") : "completed",
      candidates: values,
      queriesExecuted,
      recordsEvaluated,
      skipped,
      issues,
    };
  }
}
