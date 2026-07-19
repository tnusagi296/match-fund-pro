import type {
  GraphClaimInput,
  GraphEntityInput,
  GraphIngestionResult,
  GraphRelationshipInput,
} from "@/lib/graph/types";
import { asJson, graphEvidence, mergeGraphs, slug, websiteEntity } from "./graph-builders.server";
import { fetchPublicHtml, fetchPublicText } from "./safe-fetch.server";
import {
  anchors,
  attribute,
  canonicalDomainUrl,
  canonicalHttpsUrl,
  jsonLdObjects,
  normalizeLinkedInUrl,
  normalizeRedditUrl,
  pageTitle,
  visibleText,
} from "./source-utils.server";
import { DISCOVERY_LIMITS } from "./types";
import type { Candidate, EnrichmentAdapter, EnrichmentResult, SourceDiscoveryIssue } from "./types";

type WebsiteEnrichmentAdapterOptions = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  respectRobots?: boolean;
};

type CrawledPage = {
  url: string;
  html: string;
  title: string;
  text: string;
  kind: "personal" | "company";
};

function issue(
  message: string,
  source: "personal_website" | "company_website",
): SourceDiscoveryIssue {
  return {
    source,
    query: "bounded website enrichment",
    status: null,
    message,
    rateLimited: false,
    rateLimitResetAt: null,
  };
}

function relevantSameDomainLinks(html: string, pageUrl: string, origin: string): string[] {
  return anchors(html, pageUrl)
    .map((anchor) => canonicalHttpsUrl(anchor.href))
    .filter((url): url is string => Boolean(url))
    .filter((url) => new URL(url).origin === origin)
    .filter((url) =>
      /^\/(?:about|team|people|projects?|portfolio)(?:\/|$)/i.test(new URL(url).pathname),
    );
}

function robotsDisallows(text: string): string[] {
  const disallowed: string[] = [];
  let applies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (field?.trim().toLowerCase() === "user-agent") applies = value === "*";
    if (applies && field?.trim().toLowerCase() === "disallow" && value) disallowed.push(value);
  }
  return disallowed;
}

function allowedByRobots(url: string, disallowed: string[]): boolean {
  const path = new URL(url).pathname;
  return (
    !disallowed.some((prefix) => prefix !== "/" && path.startsWith(prefix)) &&
    !disallowed.includes("/")
  );
}

function externalIdentifiers(pages: CrawledPage[]) {
  const linkedin = new Set<string>();
  const reddit = new Set<string>();
  const github = new Set<string>();
  for (const page of pages) {
    const linked = anchors(page.html, page.url).map((anchor) => anchor.href);
    for (const item of jsonLdObjects(page.html)) {
      const sameAs = Array.isArray(item.sameAs) ? item.sameAs : item.sameAs ? [item.sameAs] : [];
      linked.push(...sameAs.filter((value): value is string => typeof value === "string"));
    }
    for (const value of linked) {
      const linkedinUrl = normalizeLinkedInUrl(value);
      if (linkedinUrl) linkedin.add(linkedinUrl);
      const redditUrl = normalizeRedditUrl(value);
      if (redditUrl) reddit.add(redditUrl);
      try {
        const url = new URL(value);
        const login = url.hostname.toLowerCase().endsWith("github.com")
          ? url.pathname.split("/").filter(Boolean)[0]
          : null;
        if (login) github.add(`https://github.com/${login}`);
      } catch {
        // Non-URLs are not identifiers.
      }
    }
  }
  return { linkedin: [...linkedin], reddit: [...reddit], github: [...github] };
}

function pageExternalUrls(page: CrawledPage): string[] {
  const values = anchors(page.html, page.url).map((anchor) => anchor.href);
  for (const item of jsonLdObjects(page.html)) {
    const sameAs = Array.isArray(item.sameAs) ? item.sameAs : item.sameAs ? [item.sameAs] : [];
    values.push(...sameAs.filter((value): value is string => typeof value === "string"));
  }
  return values;
}

function pageLinksToIdentifier(page: CrawledPage, value: string): boolean {
  return pageExternalUrls(page).some((candidate) => {
    const linkedIn = normalizeLinkedInUrl(candidate);
    if (linkedIn && linkedIn === value) return true;
    const reddit = normalizeRedditUrl(candidate);
    if (reddit && reddit === value) return true;
    try {
      const url = new URL(candidate);
      const login = url.hostname.toLowerCase().endsWith("github.com")
        ? url.pathname.split("/").filter(Boolean)[0]
        : null;
      return Boolean(login && `https://github.com/${login}` === value);
    } catch {
      return false;
    }
  });
}

function explicitFounderMention(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`${escaped}.{0,100}\\b(?:co-?founder|founder)\\b`, "i").test(text) ||
    new RegExp(`\\b(?:co-?founder|founder)\\b.{0,100}${escaped}`, "i").test(text)
  );
}

function listedTechnologies(pages: CrawledPage[]): string[] {
  const values = pages.flatMap((page) => {
    const data = page.html.match(/\bdata-technologies\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] ?? "";
    return data
      .split(/[,|]/)
      .map((value) => value.trim())
      .filter(Boolean);
  });
  return [...new Set(values)].slice(0, 20);
}

export class WebsiteEnrichmentAdapter implements EnrichmentAdapter {
  private readonly fetchImpl?: typeof fetch;
  private readonly now: () => Date;
  private readonly respectRobots: boolean;

  constructor(options: WebsiteEnrichmentAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl;
    this.now = options.now ?? (() => new Date());
    this.respectRobots = options.respectRobots ?? true;
  }

  supports(candidate: Candidate): boolean {
    return Boolean(candidate.urls?.personalWebsite || candidate.urls?.companyWebsite);
  }

  async enrich(candidate: Candidate): Promise<EnrichmentResult> {
    const founder = candidate.graph?.entities.find((entity) => entity.entityType === "founder");
    const organization = candidate.graph?.entities.find((entity) =>
      ["company", "legal_entity", "organization"].includes(entity.entityType),
    );

    const seeds = [
      candidate.urls?.personalWebsite
        ? { url: candidate.urls.personalWebsite, kind: "personal" as const }
        : null,
      candidate.urls?.companyWebsite
        ? { url: candidate.urls.companyWebsite, kind: "company" as const }
        : null,
    ].filter((item): item is { url: string; kind: "personal" | "company" } => Boolean(item?.url));
    const pages: CrawledPage[] = [];
    const issues: SourceDiscoveryIssue[] = [];
    for (const seed of seeds) {
      const homepage = canonicalDomainUrl(seed.url);
      if (!homepage) {
        issues.push(issue("Website URL is not a public HTTP(S) address.", `${seed.kind}_website`));
        continue;
      }
      const origin = new URL(homepage).origin;
      let disallowed: string[] = [];
      if (this.respectRobots) {
        try {
          disallowed = robotsDisallows(
            (
              await fetchPublicText(`${origin}/robots.txt`, {
                fetchImpl: this.fetchImpl,
                maxBytes: 100_000,
                allowedOrigins: [origin],
              })
            ).text,
          );
        } catch {
          // A missing robots file does not prohibit this bounded public fetch.
        }
      }
      const queue: Array<{ url: string; depth: number }> = [{ url: homepage, depth: 0 }];
      const seen = new Set<string>();
      while (queue.length > 0 && seen.size < DISCOVERY_LIMITS.maxWebsitePages) {
        const next = queue.shift();
        if (!next || seen.has(next.url) || !allowedByRobots(next.url, disallowed)) continue;
        seen.add(next.url);
        try {
          const fetched = await fetchPublicHtml(next.url, {
            fetchImpl: this.fetchImpl,
            allowedOrigins: [origin],
          });
          const page = {
            url: fetched.canonicalUrl,
            html: fetched.html,
            title: pageTitle(fetched.html) ?? new URL(fetched.canonicalUrl).hostname,
            text: visibleText(fetched.html),
            kind: seed.kind,
          };
          pages.push(page);
          if (next.depth < DISCOVERY_LIMITS.maxWebsiteDepth) {
            for (const url of relevantSameDomainLinks(page.html, page.url, origin)) {
              if (!seen.has(url)) queue.push({ url, depth: next.depth + 1 });
            }
          }
        } catch (error) {
          issues.push(
            issue(
              error instanceof Error ? error.message : "Website page fetch failed.",
              `${seed.kind}_website`,
            ),
          );
        }
      }
    }

    const external = externalIdentifiers(pages);
    const identifiers = [
      ...(founder?.identifiers ?? []),
      ...seeds.flatMap((seed) => {
        const url = canonicalDomainUrl(seed.url);
        return founder && url && seed.kind === "personal"
          ? [{ scheme: "personal_website_url", value: url } as const]
          : [];
      }),
      ...external.linkedin.map((value) => ({ scheme: "linkedin_url" as const, value })),
      ...external.reddit.map((value) => ({ scheme: "reddit_url" as const, value })),
      ...external.github.map((value) => ({
        scheme: "github_login" as const,
        value: new URL(value).pathname.split("/").filter(Boolean)[0]!.toLowerCase(),
      })),
    ];
    const uniqueIdentifiers = [
      ...new Map(
        identifiers.map((identifier) => [`${identifier.scheme}:${identifier.value}`, identifier]),
      ).values(),
    ];
    const founderProperties =
      founder?.properties &&
      typeof founder.properties === "object" &&
      !Array.isArray(founder.properties)
        ? founder.properties
        : {};
    const entities: GraphEntityInput[] = founder
      ? [
          {
            ...founder,
            identifiers: uniqueIdentifiers,
            properties: {
              ...founderProperties,
              linkedInUrl: external.linkedin[0] ?? null,
              redditUrl: external.reddit[0] ?? null,
            },
          },
        ]
      : [];
    const relationships: GraphRelationshipInput[] = [];
    const claims: GraphClaimInput[] = [];
    const evidence = pages.map((page, index) =>
      graphEvidence({
        tempId: `evidence:website:${slug(page.url)}:${index}`,
        sourceType: page.kind === "personal" ? "personal_website" : "company_website",
        sourceUrl: page.url,
        sourceExternalId: page.url,
        retrievedAt: this.now().toISOString(),
        excerpt: page.text.slice(0, 1200),
        rawPayload: {
          title: page.title,
          sameAs: jsonLdObjects(page.html).flatMap((item) =>
            Array.isArray(item.sameAs) ? item.sameAs : item.sameAs ? [item.sameAs] : [],
          ),
        },
        reliability: 0.75,
        pageTitle: page.title,
        extractionMethod: "bounded_same_domain_html_metadata",
        trustLevel: "medium",
        sourceName: page.title,
      }),
    );
    const websiteNodes = new Map<"personal" | "company", GraphEntityInput>();

    for (const seed of seeds) {
      const node = websiteEntity(
        `website:${seed.kind}:${slug(seed.url)}`,
        seed.url,
        `${candidate.displayName ?? "Candidate"} ${seed.kind} website`,
        seed.kind,
      );
      const pageIndex = pages.findIndex((page) => page.kind === seed.kind);
      if (!node || pageIndex < 0) continue;
      entities.push(node);
      websiteNodes.set(seed.kind, node);
      const sourceEntity = seed.kind === "personal" ? founder : (organization ?? founder);
      if (!sourceEntity) continue;
      relationships.push({
        tempId: `relationship:${sourceEntity.tempId}:HAS_WEBSITE:${node.tempId}`,
        sourceTempId: sourceEntity.tempId,
        targetTempId: node.tempId,
        relationshipType: "HAS_WEBSITE",
        confidence: seed.kind === "personal" ? 0.8 : 0.65,
        observedAt: this.now().toISOString(),
        validFrom: null,
        validTo: null,
        properties: { verificationStatus: "supported", crossLinked: true, websiteKind: seed.kind },
        evidenceTempIds: [evidence[pageIndex].tempId],
      });
    }

    for (const [index, value] of [...external.linkedin, ...external.reddit].entries()) {
      const isLinkedIn = Boolean(normalizeLinkedInUrl(value));
      const socialTempId = `social:${isLinkedIn ? "linkedin" : "reddit"}:${slug(value)}`;
      const pageIndex = pages.findIndex((page) => pageLinksToIdentifier(page, value));
      if (pageIndex < 0) continue;
      entities.push({
        tempId: socialTempId,
        entityType: "social_account",
        canonicalKey: socialTempId,
        canonicalName: isLinkedIn ? "LinkedIn identifier" : "Reddit identifier",
        properties: { url: value, fetched: false },
        identifiers: [{ scheme: "canonical_url", value }],
      });
      const sourceEntity = founder ?? websiteNodes.get(pages[pageIndex].kind);
      if (!sourceEntity) continue;
      relationships.push({
        tempId: `relationship:${sourceEntity.tempId}:HAS_SOCIAL_IDENTIFIER:${socialTempId}`,
        sourceTempId: sourceEntity.tempId,
        targetTempId: socialTempId,
        relationshipType: "HAS_SOCIAL_IDENTIFIER",
        confidence: isLinkedIn ? 0.7 : 0.5,
        observedAt: this.now().toISOString(),
        validFrom: null,
        validTo: null,
        properties: {
          verificationStatus: "supported",
          identifierOnly: isLinkedIn,
          contentFetched: false,
        },
        evidenceTempIds: [evidence[pageIndex].tempId],
      });
      claims.push({
        tempId: `claim:${sourceEntity.tempId}:linked-social:${slug(value)}`,
        subjectTempId: sourceEntity.tempId,
        predicate: "website_links_social_identifier",
        value: { url: value, platform: isLinkedIn ? "linkedin" : "reddit" },
        status: "supported",
        trustLevel: isLinkedIn ? "medium" : "low",
        observedAt: this.now().toISOString(),
        evidenceTempIds: [evidence[pageIndex].tempId],
      });
    }

    if (founder) {
      for (const githubUrl of external.github) {
        const pageIndex = pages.findIndex((page) => pageLinksToIdentifier(page, githubUrl));
        if (pageIndex < 0) continue;
        claims.push({
          tempId: `claim:${founder.tempId}:linked-github:${slug(githubUrl)}`,
          subjectTempId: founder.tempId,
          predicate: "website_links_github_identifier",
          value: { url: githubUrl },
          status: "supported",
          trustLevel: "medium",
          observedAt: this.now().toISOString(),
          evidenceTempIds: [evidence[pageIndex].tempId],
        });
      }
    }

    const technologies = listedTechnologies(pages);
    for (const technology of technologies) {
      const technologyTempId = `skill:technology:${slug(technology)}`;
      const supportingPage = pages.find((page) => page.html.includes(technology));
      const pageIndex = supportingPage ? pages.indexOf(supportingPage) : -1;
      if (pageIndex < 0) continue;
      entities.push({
        tempId: technologyTempId,
        entityType: "skill",
        canonicalKey: `technology:${slug(technology)}`,
        canonicalName: technology,
        properties: {},
        identifiers: [],
      });
      const sourceEntity = founder ?? organization;
      if (!sourceEntity) continue;
      relationships.push({
        tempId: `relationship:${sourceEntity.tempId}:USES_TECHNOLOGY:${technologyTempId}`,
        sourceTempId: sourceEntity.tempId,
        targetTempId: technologyTempId,
        relationshipType: "USES_TECHNOLOGY",
        confidence: 0.7,
        observedAt: this.now().toISOString(),
        validFrom: null,
        validTo: null,
        properties: { verificationStatus: "supported", basis: "explicit_website_technology_list" },
        evidenceTempIds: [evidence[pageIndex].tempId],
      });
      claims.push({
        tempId: `claim:${sourceEntity.tempId}:website-technology:${slug(technology)}`,
        subjectTempId: sourceEntity.tempId,
        predicate: "website_lists_technology",
        value: technology,
        status: "supported",
        trustLevel: "medium",
        observedAt: this.now().toISOString(),
        evidenceTempIds: [evidence[pageIndex].tempId],
      });
    }

    const company = candidate.graph?.entities.find((entity) => entity.entityType === "company");
    const founderPage = founder
      ? pages.find((page) =>
          explicitFounderMention(page.text, candidate.displayName ?? founder.canonicalName),
        )
      : null;
    if (founder && company && founderPage) {
      const pageIndex = pages.indexOf(founderPage);
      relationships.push({
        tempId: `relationship:${founder.tempId}:FOUNDED:${company.tempId}:website`,
        sourceTempId: founder.tempId,
        targetTempId: company.tempId,
        relationshipType: "FOUNDED",
        confidence: 0.75,
        observedAt: this.now().toISOString(),
        validFrom: null,
        validTo: null,
        properties: { verificationStatus: "supported", basis: "explicit_website_founder_role" },
        evidenceTempIds: [evidence[pageIndex].tempId],
      });
    }

    const graph: GraphIngestionResult = { entities, relationships, claims, evidence };
    return {
      source: candidate.urls?.personalWebsite ? "personal_website" : "company_website",
      status: issues.length > 0 ? (pages.length > 0 ? "partial" : "failed") : "completed",
      candidate,
      graph: mergeGraphs(graph),
      identifiers: uniqueIdentifiers,
      pagesFetched: pages.length,
      issues,
    };
  }
}
