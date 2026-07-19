import type {
  GraphClaimInput,
  GraphEntityInput,
  GraphIngestionResult,
  GraphRelationshipInput,
} from "@/lib/graph/types";
import type { Thesis } from "@/lib/thesis";
import { asJson, graphEvidence, slug, websiteEntity } from "./graph-builders.server";
import { DiscoveryPlanner } from "./planner.server";
import { fetchPublicJson } from "./safe-fetch.server";
import type { GermanRegisterConfiguration } from "./source-registry.server";
import { canonicalDomainUrl } from "./source-utils.server";
import { DISCOVERY_LIMITS } from "./types";
import type {
  DiscoveryAdapter,
  DiscoveryReason,
  DiscoveryResult,
  PublicDiscoveryCandidate,
  SourceDiscoveryIssue,
  SourceDiscoveryPlan,
} from "./types";

type GermanRegisterOfficer = {
  name: string;
  role: "managing_director" | "shareholder" | "registered_representative";
  sourceId?: string | null;
};

export type GermanRegisterRecord = {
  euid?: string | null;
  registerCourt: string;
  registerType: string;
  registerNumber: string;
  legalName: string;
  registrationDate: string | null;
  legalForm: string | null;
  location: string | null;
  businessPurpose: string | null;
  officers: GermanRegisterOfficer[];
  website?: string | null;
};

type RegisterFeed = { records: GermanRegisterRecord[] } | GermanRegisterRecord[];

type GermanRegisterAdapterOptions = {
  configuration: GermanRegisterConfiguration | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

function issue(message: string, status: number | null = null): SourceDiscoveryIssue {
  return {
    source: "german_register",
    query: "configured permitted feed",
    status,
    message,
    rateLimited: status === 429,
    rateLimitResetAt: null,
  };
}

function registerKey(record: GermanRegisterRecord): string | null {
  if (record.euid?.trim()) return record.euid.trim().toUpperCase();
  const values = [record.registerCourt, record.registerType, record.registerNumber].map((value) =>
    value.trim().toUpperCase(),
  );
  return values.every(Boolean) ? values.join(":") : null;
}

function validRecord(value: unknown): value is GermanRegisterRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.legalName === "string" &&
    typeof record.registerCourt === "string" &&
    typeof record.registerType === "string" &&
    typeof record.registerNumber === "string" &&
    Array.isArray(record.officers)
  );
}

function legalRoleRelationship(
  role: GermanRegisterOfficer["role"],
): GraphRelationshipInput["relationshipType"] {
  if (role === "shareholder") return "SHAREHOLDER_OF";
  if (role === "registered_representative") return "REGISTERED_REPRESENTATIVE_OF";
  return "MANAGING_DIRECTOR_OF";
}

function recordGraph(input: {
  record: GermanRegisterRecord;
  officer: GermanRegisterOfficer;
  key: string;
  sourceUrl: string;
  sourceName: string;
  observedAt: string;
}): GraphIngestionResult {
  const { record, officer, key, sourceUrl, sourceName, observedAt } = input;
  const legalEntityTempId = `legal-entity:${slug(key)}`;
  const registrationTempId = `registration:${slug(key)}`;
  const personSourceId = officer.sourceId?.trim() || `${key}:${officer.role}:${officer.name}`;
  const personTempId = `person:register:${slug(personSourceId)}`;
  const evidenceTempId = `evidence:register:${slug(key)}`;
  const website = record.website ? canonicalDomainUrl(record.website) : null;
  const entities: GraphEntityInput[] = [
    {
      tempId: legalEntityTempId,
      entityType: "legal_entity",
      canonicalKey: `german-register:${slug(key)}`,
      canonicalName: record.legalName,
      properties: asJson({
        legalForm: record.legalForm,
        location: record.location,
        businessPurpose: record.businessPurpose,
        registrationDate: record.registrationDate,
        holdingCompany: /\bholding\b/i.test(record.legalName),
      }),
      identifiers: [
        ...(record.euid
          ? ([{ scheme: "euid", value: key }] satisfies GraphEntityInput["identifiers"])
          : []),
        { scheme: "german_register_key", value: key },
        ...(website
          ? ([
              { scheme: "company_website_url", value: website },
              { scheme: "company_domain", value: new URL(website).hostname },
            ] satisfies GraphEntityInput["identifiers"])
          : []),
      ],
    },
    {
      tempId: registrationTempId,
      entityType: "registration",
      canonicalKey: `german-registration:${slug(key)}`,
      canonicalName: `${record.registerCourt} ${record.registerType} ${record.registerNumber}`,
      properties: asJson({
        court: record.registerCourt,
        type: record.registerType,
        number: record.registerNumber,
        date: record.registrationDate,
      }),
      identifiers: [{ scheme: "source_external_id", value: `registration:${key}` }],
    },
    {
      tempId: personTempId,
      entityType: "person",
      canonicalKey: `german-register-person:${slug(personSourceId)}`,
      canonicalName: officer.name,
      properties: { legalRole: officer.role, sourceRecord: key },
      identifiers: [{ scheme: "source_external_id", value: `register-person:${personSourceId}` }],
    },
  ];
  const websiteNode = website
    ? websiteEntity(
        `website:register:${slug(website)}`,
        website,
        `${record.legalName} website`,
        "company",
      )
    : null;
  if (websiteNode) entities.push(websiteNode);
  const relationships: GraphRelationshipInput[] = [
    {
      tempId: `relationship:${personTempId}:${legalRoleRelationship(officer.role)}:${legalEntityTempId}`,
      sourceTempId: personTempId,
      targetTempId: legalEntityTempId,
      relationshipType: legalRoleRelationship(officer.role),
      confidence: 0.98,
      observedAt,
      validFrom: record.registrationDate,
      validTo: null,
      properties: {
        legalRole: officer.role,
        verificationStatus: "supported",
        notFounderClaim: true,
      },
      evidenceTempIds: [evidenceTempId],
    },
    {
      tempId: `relationship:${legalEntityTempId}:SUPPORTED_BY:${registrationTempId}`,
      sourceTempId: legalEntityTempId,
      targetTempId: registrationTempId,
      relationshipType: "SUPPORTED_BY",
      confidence: 0.99,
      observedAt,
      validFrom: record.registrationDate,
      validTo: null,
      properties: { verificationStatus: "supported" },
      evidenceTempIds: [evidenceTempId],
    },
  ];
  if (websiteNode) {
    relationships.push({
      tempId: `relationship:${legalEntityTempId}:HAS_WEBSITE:${websiteNode.tempId}`,
      sourceTempId: legalEntityTempId,
      targetTempId: websiteNode.tempId,
      relationshipType: "HAS_WEBSITE",
      confidence: 0.8,
      observedAt,
      validFrom: null,
      validTo: null,
      properties: { verificationStatus: "supported" },
      evidenceTempIds: [evidenceTempId],
    });
  }
  const claims: GraphClaimInput[] = [
    {
      tempId: `claim:${personTempId}:legal-role:${slug(key)}`,
      subjectTempId: personTempId,
      predicate: "registered_legal_role",
      value: { company: record.legalName, role: officer.role, registerKey: key },
      status: "supported",
      trustLevel: "high",
      observedAt,
      evidenceTempIds: [evidenceTempId],
    },
    {
      tempId: `claim:${legalEntityTempId}:registration`,
      subjectTempId: legalEntityTempId,
      predicate: "company_registration",
      value: {
        registerKey: key,
        registrationDate: record.registrationDate,
        legalForm: record.legalForm,
        location: record.location,
      },
      status: "supported",
      trustLevel: "high",
      observedAt,
      evidenceTempIds: [evidenceTempId],
    },
  ];
  if (record.businessPurpose) {
    claims.push({
      tempId: `claim:${legalEntityTempId}:business-purpose`,
      subjectTempId: legalEntityTempId,
      predicate: "registered_business_purpose",
      value: record.businessPurpose,
      status: "supported",
      trustLevel: "high",
      observedAt,
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
        sourceType: "german_register_feed",
        sourceUrl,
        sourceExternalId: key,
        retrievedAt: observedAt,
        excerpt: `${record.legalName}; ${record.businessPurpose ?? "business purpose unavailable"}; ${officer.name} is listed as ${officer.role.replaceAll("_", " ")}.`,
        rawPayload: {
          euid: record.euid ?? null,
          court: record.registerCourt,
          registerType: record.registerType,
          registerNumber: record.registerNumber,
          legalName: record.legalName,
          registrationDate: record.registrationDate,
          legalForm: record.legalForm,
          location: record.location,
          businessPurpose: record.businessPurpose,
          officer,
          website,
        },
        reliability: 0.98,
        pageTitle: `${sourceName} · ${record.legalName}`,
        extractionMethod: "permitted_structured_register_feed",
        trustLevel: "high",
        sourceName,
        metadata: {
          notFounderEvidence: true,
          holdingCompany: /\bholding\b/i.test(record.legalName),
        },
      }),
    ],
  };
}

export class GermanRegisterDiscoveryAdapter implements DiscoveryAdapter {
  private readonly fetchImpl?: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly options: GermanRegisterAdapterOptions) {
    this.fetchImpl = options.fetchImpl;
    this.now = options.now ?? (() => new Date());
  }

  async plan(thesis: Thesis): Promise<SourceDiscoveryPlan> {
    const plan = new DiscoveryPlanner()
      .plan(thesis)
      .sources.find((item) => item.source === "german_register");
    if (!plan) throw new Error("German register discovery plan was not generated.");
    return plan;
  }

  async discover(plan: SourceDiscoveryPlan): Promise<DiscoveryResult> {
    if (plan.source !== "german_register")
      throw new Error("Register adapter received the wrong plan.");
    const configuration = this.options.configuration;
    if (!configuration) {
      return {
        source: "german_register",
        status: "disabled_unconfigured",
        candidates: [],
        queriesExecuted: 0,
        recordsEvaluated: 0,
        skipped: 0,
        issues: [issue("No permitted German register feed is configured.")],
      };
    }
    let feed: RegisterFeed;
    try {
      feed = (
        await fetchPublicJson<RegisterFeed>(configuration.feedUrl, {
          fetchImpl: this.fetchImpl,
          headers: { Authorization: `Bearer ${configuration.apiKey}` },
        })
      ).value;
    } catch (error) {
      return {
        source: "german_register",
        status: "failed",
        candidates: [],
        queriesExecuted: 1,
        recordsEvaluated: 0,
        skipped: 0,
        issues: [issue(error instanceof Error ? error.message : "Register feed failed.")],
      };
    }
    const records = (Array.isArray(feed) ? feed : feed.records).filter(validRecord);
    const candidates: PublicDiscoveryCandidate[] = [];
    let skipped = 0;
    const observedAt = this.now().toISOString();
    for (const record of records.slice(0, DISCOVERY_LIMITS.maxCandidates)) {
      const key = registerKey(record);
      if (!key) {
        skipped += 1;
        continue;
      }
      const purpose = record.businessPurpose?.toLowerCase() ?? "";
      const matchedQueries = plan.queries.filter((query) => {
        const normalizedQuery = query.query.toLowerCase();
        return (
          purpose.includes(normalizedQuery) ||
          normalizedQuery
            .split(/[^a-z0-9]+/)
            .filter((term) => term.length >= 4)
            .some((term) => purpose.includes(term))
        );
      });
      if (plan.queries.length > 0 && matchedQueries.length === 0) {
        skipped += 1;
        continue;
      }
      for (const officer of record.officers) {
        if (
          !officer?.name ||
          !["managing_director", "shareholder", "registered_representative"].includes(officer.role)
        ) {
          skipped += 1;
          continue;
        }
        const graph = recordGraph({
          record,
          officer,
          key,
          sourceUrl: configuration.feedUrl,
          sourceName: configuration.sourceName,
          observedAt,
        });
        const reasons: DiscoveryReason[] = matchedQueries.map((query) => ({
          source: "german_register",
          query: query.query,
          planReason: query.reason,
          sourceName: configuration.sourceName,
          resultName: record.legalName,
          resultUrl: configuration.feedUrl,
        }));
        candidates.push({
          source: "german_register",
          sourceIdentifier: `${key}:${officer.role}:${officer.sourceId ?? slug(officer.name)}`,
          displayName: officer.name,
          sourceUrl: configuration.feedUrl,
          explicitFounderRole: false,
          identifiers: [],
          urls: { companyWebsite: record.website ?? null },
          discoveryReasons: reasons,
          graph,
          context: asJson({
            registerKey: key,
            companyName: record.legalName,
            legalRole: officer.role,
            notFounderClaim: true,
            holdingCompany: /\bholding\b/i.test(record.legalName),
          }),
        });
      }
    }
    return {
      source: "german_register",
      status: "completed",
      candidates,
      queriesExecuted: 1,
      recordsEvaluated: records.length,
      skipped,
      issues: [],
    };
  }
}
