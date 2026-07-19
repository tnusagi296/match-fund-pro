import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { parseGitHubLogin } from "./github-graph.server";
import type {
  GraphClaimInput,
  GraphEntityInput,
  GraphEvidenceInput,
  GraphFragmentPersistenceResult,
  GraphIdentifierInput,
  GraphIngestionResult,
  GraphPersistenceResult,
  GraphRelationshipInput,
  ProfileClaimStatus,
  ProfileOrigin,
  ProfileVisibilityState,
} from "./types";

type PersistedRecord = { id: string; created: boolean };

export interface GraphPersistenceStore {
  findEntityByIdentifier(identifier: GraphIdentifierInput): Promise<string | null>;
  upsertEntity(entity: GraphEntityInput, existingId: string | null): Promise<PersistedRecord>;
  upsertIdentifier(entityId: string, identifier: GraphIdentifierInput): Promise<void>;
  upsertEvidence(evidence: GraphEvidenceInput): Promise<PersistedRecord>;
  upsertRelationship(
    relationship: GraphRelationshipInput,
    sourceEntityId: string,
    targetEntityId: string,
  ): Promise<PersistedRecord>;
  linkRelationshipEvidence(relationshipId: string, evidenceId: string): Promise<void>;
  upsertClaim(claim: GraphClaimInput, subjectEntityId: string): Promise<PersistedRecord>;
  linkClaimEvidence(claimId: string, evidenceId: string): Promise<void>;
  linkProfile(profileId: string, founderEntityId: string): Promise<void>;
  recordPossibleResolution?(
    leftEntityId: string,
    rightEntityId: string,
    reason: string,
    identifiers: GraphIdentifierInput[],
  ): Promise<void>;
}

export class GraphPersistenceError extends Error {
  constructor(
    readonly stage: string,
    readonly completed: Record<string, number>,
    cause: unknown,
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Graph persistence failed during ${stage}: ${detail}`);
    this.name = "GraphPersistenceError";
  }
}

function jsonKey(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(jsonKey).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${jsonKey(nested ?? null)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function asObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function requireResolved(map: Map<string, string>, tempId: string, kind: string): string {
  const id = map.get(tempId);
  if (!id) throw new Error(`${kind} temporary ID was not resolved: ${tempId}`);
  return id;
}

export async function persistGraphFragmentWithStore(
  store: GraphPersistenceStore,
  result: GraphIngestionResult,
): Promise<GraphFragmentPersistenceResult> {
  const completed = { entities: 0, evidence: 0, relationships: 0, claims: 0 };
  let stage = "entity upsert";
  const entityIds = new Map<string, string>();
  const evidenceIds = new Map<string, string>();

  try {
    for (const entity of result.entities) {
      const identifierMatches = new Set<string>();
      for (const identifier of entity.identifiers) {
        const match = await store.findEntityByIdentifier(identifier);
        if (match) identifierMatches.add(match);
      }
      if (identifierMatches.size > 1) {
        const matchedIds = [...identifierMatches].sort();
        if (store.recordPossibleResolution) {
          for (let left = 0; left < matchedIds.length; left += 1) {
            for (let right = left + 1; right < matchedIds.length; right += 1) {
              await store.recordPossibleResolution(
                matchedIds[left],
                matchedIds[right],
                `Stable identifiers supplied for ${entity.tempId} resolve to different entities.`,
                entity.identifiers,
              );
            }
          }
        }
        throw new Error(`Stable identifiers for ${entity.tempId} resolve to different entities.`);
      }
      const existingId = identifierMatches.values().next().value ?? null;
      const persisted = await store.upsertEntity(entity, existingId);
      entityIds.set(entity.tempId, persisted.id);
      if (persisted.created) completed.entities += 1;

      for (const identifier of entity.identifiers) {
        await store.upsertIdentifier(persisted.id, identifier);
      }
    }

    stage = "evidence upsert";
    for (const item of result.evidence) {
      const persisted = await store.upsertEvidence(item);
      evidenceIds.set(item.tempId, persisted.id);
      if (persisted.created) completed.evidence += 1;
    }

    stage = "relationship upsert";
    for (const relationship of result.relationships) {
      const sourceId = requireResolved(entityIds, relationship.sourceTempId, "Relationship source");
      const targetId = requireResolved(entityIds, relationship.targetTempId, "Relationship target");
      const persisted = await store.upsertRelationship(relationship, sourceId, targetId);
      if (persisted.created) completed.relationships += 1;
      for (const evidenceTempId of relationship.evidenceTempIds) {
        await store.linkRelationshipEvidence(
          persisted.id,
          requireResolved(evidenceIds, evidenceTempId, "Relationship evidence"),
        );
      }
    }

    stage = "claim upsert";
    for (const claim of result.claims) {
      const subjectId = requireResolved(entityIds, claim.subjectTempId, "Claim subject");
      const persisted = await store.upsertClaim(claim, subjectId);
      if (persisted.created) completed.claims += 1;
      for (const evidenceTempId of claim.evidenceTempIds) {
        await store.linkClaimEvidence(
          persisted.id,
          requireResolved(evidenceIds, evidenceTempId, "Claim evidence"),
        );
      }
    }

    const lastUpdated = result.evidence.reduce(
      (latest, item) => (item.retrievedAt > latest ? item.retrievedAt : latest),
      new Date(0).toISOString(),
    );

    return {
      entityIds: Object.fromEntries(entityIds),
      evidenceIds: Object.fromEntries(evidenceIds),
      summary: {
        repositoriesFound: result.entities.filter((entity) => entity.entityType === "repository")
          .length,
        projectsFound: result.entities.filter((entity) => entity.entityType === "project").length,
        hackathonsFound: result.entities.filter((entity) => entity.entityType === "hackathon")
          .length,
        organizationsFound: result.entities.filter((entity) => entity.entityType === "organization")
          .length,
        entitiesCreated: completed.entities,
        evidenceCreated: completed.evidence,
        relationshipsCreated: completed.relationships,
        claimsCreated: completed.claims,
        claimsSupported: result.claims.filter((claim) => claim.status === "supported").length,
        lastUpdated,
      },
    };
  } catch (error) {
    throw new GraphPersistenceError(stage, completed, error);
  }
}

export async function persistGraphIngestionWithStore(
  store: GraphPersistenceStore,
  result: GraphIngestionResult,
  profileId: string,
): Promise<GraphPersistenceResult> {
  const founders = result.entities.filter((entity) => entity.entityType === "founder");
  if (founders.length !== 1) {
    throw new Error("A founder profile ingestion must contain exactly one founder entity.");
  }

  const persisted = await persistGraphFragmentWithStore(store, result);
  const founderEntityId = persisted.entityIds[founders[0].tempId];
  if (!founderEntityId) throw new Error("The persisted founder entity could not be resolved.");

  try {
    await store.upsertIdentifier(founderEntityId, {
      scheme: "matchfund_profile_id",
      value: profileId,
    });
    await store.linkProfile(profileId, founderEntityId);
  } catch (error) {
    throw new GraphPersistenceError(
      "founder profile link",
      {
        entities: persisted.summary.entitiesCreated,
        evidence: persisted.summary.evidenceCreated,
        relationships: persisted.summary.relationshipsCreated,
        claims: persisted.summary.claimsCreated,
      },
      error,
    );
  }

  return {
    founderEntityId,
    profileId,
    summary: persisted.summary,
  };
}

export class SupabaseGraphStore implements GraphPersistenceStore {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findEntityByIdentifier(identifier: GraphIdentifierInput): Promise<string | null> {
    const { data, error } = await this.client
      .from("graph_entity_identifiers")
      .select("entity_id")
      .eq("scheme", identifier.scheme)
      .eq("value", identifier.value)
      .maybeSingle();
    if (error) throw error;
    return data?.entity_id ?? null;
  }

  async upsertEntity(
    entity: GraphEntityInput,
    existingId: string | null,
  ): Promise<PersistedRecord> {
    let entityId = existingId;
    if (!entityId) {
      const { data: existing, error: findError } = await this.client
        .from("graph_entities")
        .select("id")
        .eq("entity_type", entity.entityType)
        .eq("canonical_key", entity.canonicalKey)
        .maybeSingle();
      if (findError) throw findError;
      entityId = existing?.id ?? null;
    }

    if (entityId) {
      const { data, error } = await this.client
        .from("graph_entities")
        .update({ canonical_name: entity.canonicalName, properties: entity.properties })
        .eq("id", entityId)
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, created: false };
    }

    const { data, error } = await this.client
      .from("graph_entities")
      .insert({
        entity_type: entity.entityType,
        canonical_key: entity.canonicalKey,
        canonical_name: entity.canonicalName,
        properties: entity.properties,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, created: true };
  }

  async upsertIdentifier(entityId: string, identifier: GraphIdentifierInput): Promise<void> {
    const { error } = await this.client
      .from("graph_entity_identifiers")
      .upsert(
        { entity_id: entityId, scheme: identifier.scheme, value: identifier.value },
        { onConflict: "scheme,value" },
      );
    if (error) throw error;
  }

  async upsertEvidence(evidence: GraphEvidenceInput): Promise<PersistedRecord> {
    const { data: existing, error: findError } = await this.client
      .from("graph_evidence")
      .select("id")
      .eq("content_hash", evidence.contentHash)
      .maybeSingle();
    if (findError) throw findError;

    const values = {
      source_type: evidence.sourceType,
      source_url: evidence.sourceUrl,
      source_external_id: evidence.sourceExternalId,
      retrieved_at: evidence.retrievedAt,
      excerpt: evidence.excerpt,
      raw_payload: evidence.rawPayload,
      content_hash: evidence.contentHash,
      reliability: evidence.reliability,
      page_title: evidence.pageTitle,
      extraction_method: evidence.extractionMethod,
      trust_level: evidence.trustLevel,
      metadata: evidence.metadata,
    };
    if (existing) {
      const { data, error } = await this.client
        .from("graph_evidence")
        .update(values)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, created: false };
    }
    const { data, error } = await this.client
      .from("graph_evidence")
      .insert(values)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, created: true };
  }

  async upsertRelationship(
    relationship: GraphRelationshipInput,
    sourceEntityId: string,
    targetEntityId: string,
  ): Promise<PersistedRecord> {
    const { data: existing, error: findError } = await this.client
      .from("graph_relationships")
      .select("id")
      .eq("source_entity_id", sourceEntityId)
      .eq("target_entity_id", targetEntityId)
      .eq("relationship_type", relationship.relationshipType)
      .maybeSingle();
    if (findError) throw findError;
    const values = {
      source_entity_id: sourceEntityId,
      target_entity_id: targetEntityId,
      relationship_type: relationship.relationshipType,
      confidence: relationship.confidence,
      observed_at: relationship.observedAt,
      valid_from: relationship.validFrom,
      valid_to: relationship.validTo,
      properties: relationship.properties,
    };
    if (existing) {
      const { data, error } = await this.client
        .from("graph_relationships")
        .update(values)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, created: false };
    }
    const { data, error } = await this.client
      .from("graph_relationships")
      .insert(values)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, created: true };
  }

  async linkRelationshipEvidence(relationshipId: string, evidenceId: string): Promise<void> {
    const { error } = await this.client
      .from("graph_relationship_evidence")
      .upsert(
        { relationship_id: relationshipId, evidence_id: evidenceId },
        { onConflict: "relationship_id,evidence_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  async upsertClaim(claim: GraphClaimInput, subjectEntityId: string): Promise<PersistedRecord> {
    const { data: candidates, error: findError } = await this.client
      .from("graph_claims")
      .select("id,value")
      .eq("subject_entity_id", subjectEntityId)
      .eq("predicate", claim.predicate);
    if (findError) throw findError;
    const existing = candidates.find(
      (candidate) => jsonKey(candidate.value) === jsonKey(claim.value),
    );
    const values = {
      subject_entity_id: subjectEntityId,
      predicate: claim.predicate,
      value: claim.value,
      status: claim.status,
      trust_level: claim.trustLevel,
      observed_at: claim.observedAt,
    };
    if (existing) {
      const { data, error } = await this.client
        .from("graph_claims")
        .update(values)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, created: false };
    }
    const { data, error } = await this.client
      .from("graph_claims")
      .insert(values)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, created: true };
  }

  async linkClaimEvidence(claimId: string, evidenceId: string): Promise<void> {
    const { error } = await this.client
      .from("graph_claim_evidence")
      .upsert(
        { claim_id: claimId, evidence_id: evidenceId },
        { onConflict: "claim_id,evidence_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  async linkProfile(profileId: string, founderEntityId: string): Promise<void> {
    const { error } = await this.client
      .from("founder_profiles")
      .update({ graph_entity_id: founderEntityId })
      .eq("id", profileId)
      .select("id")
      .single();
    if (error) throw error;
  }

  async recordPossibleResolution(
    leftEntityId: string,
    rightEntityId: string,
    reason: string,
    identifiers: GraphIdentifierInput[],
  ): Promise<void> {
    const [left, right] = [leftEntityId, rightEntityId].sort();
    const { error } = await this.client.from("graph_entity_resolution_candidates").upsert(
      {
        left_entity_id: left,
        right_entity_id: right,
        status: "possible",
        reason,
        identifiers_json: identifiers.map((identifier) => ({ ...identifier })),
      },
      { onConflict: "left_entity_id,right_entity_id" },
    );
    if (error) throw error;
  }
}

export async function persistGraphIngestion(
  result: GraphIngestionResult,
  profileId: string,
): Promise<GraphPersistenceResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return persistGraphIngestionWithStore(new SupabaseGraphStore(supabaseAdmin), result, profileId);
}

export async function persistGraphFragment(
  result: GraphIngestionResult,
): Promise<GraphFragmentPersistenceResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return persistGraphFragmentWithStore(new SupabaseGraphStore(supabaseAdmin), result);
}

export async function persistPublicFounderGraph(
  result: GraphIngestionResult,
  input: {
    name: string;
    headline: string;
    github?: string | null;
    linkedin?: string | null;
    site?: string | null;
    summary?: string | null;
  },
): Promise<GraphPersistenceResult> {
  const founders = result.entities.filter((entity) => entity.entityType === "founder");
  if (founders.length !== 1) {
    throw new Error("A discoverable public profile must contain exactly one founder entity.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const store = new SupabaseGraphStore(supabaseAdmin);
  const persisted = await persistGraphFragmentWithStore(store, result);
  const founderEntityId = persisted.entityIds[founders[0].tempId];
  if (!founderEntityId) throw new Error("The persisted founder entity could not be resolved.");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("founder_profiles")
    .select(
      "id,published,profile_origin,claim_status,visibility_state,name,headline,github,linkedin,site,summary",
    )
    .eq("graph_entity_id", founderEntityId)
    .maybeSingle();
  if (existingError) throw existingError;

  const protectsFounderSubmission = existing?.profile_origin === "founder_submission";
  const values = {
    name: protectsFounderSubmission ? existing.name : input.name.trim(),
    headline: protectsFounderSubmission
      ? existing.headline
      : input.headline.trim() || "Public-source founder profile",
    github: input.github || existing?.github || null,
    linkedin: protectsFounderSubmission
      ? existing.linkedin
      : input.linkedin || existing?.linkedin || null,
    site: protectsFounderSubmission ? existing.site : input.site || existing?.site || null,
    summary: protectsFounderSubmission
      ? existing.summary
      : input.summary?.trim() || input.headline.trim() || "Public-source evidence profile.",
    scores: {
      founder_score: null,
      founder_score_status: "insufficient_evidence",
      evidence_model: "multi_source_graph_v1",
    },
    profile_origin: protectsFounderSubmission ? existing.profile_origin : "public_scan",
    claim_status: protectsFounderSubmission ? existing.claim_status : "unclaimed",
    visibility_state: existing?.published ? "published" : "discoverable",
  };

  let profileId: string;
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("founder_profiles")
      .update(values)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    profileId = data.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("founder_profiles")
      .insert(values)
      .select("id")
      .single();
    if (error) throw error;
    profileId = data.id;
  }

  await store.upsertIdentifier(founderEntityId, {
    scheme: "matchfund_profile_id",
    value: profileId,
  });
  await store.linkProfile(profileId, founderEntityId);
  return {
    founderEntityId,
    profileId,
    summary: persisted.summary,
  };
}

export async function createOrUpdateFounderProfile(
  result: GraphIngestionResult,
  input: {
    name: string;
    headline: string;
    github: string;
    linkedin: string;
    site: string;
    profileOrigin?: ProfileOrigin;
    claimStatus?: ProfileClaimStatus;
    visibilityState?: ProfileVisibilityState;
  },
): Promise<{ id: string; published: boolean }> {
  const founder = result.entities.find((entity) => entity.entityType === "founder");
  if (!founder) throw new Error("GitHub ingestion did not return a founder entity.");
  const githubUserId = founder.identifiers.find(
    (identifier) => identifier.scheme === "github_user_id",
  )?.value;
  const login = founder.identifiers.find(
    (identifier) => identifier.scheme === "github_login",
  )?.value;
  if (!githubUserId || !login)
    throw new Error("GitHub ingestion did not return stable founder identifiers.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const store = new SupabaseGraphStore(supabaseAdmin);
  const existingEntityId = await store.findEntityByIdentifier({
    scheme: "github_user_id",
    value: githubUserId,
  });

  type ExistingProfile = {
    id: string;
    published: boolean;
    profile_origin: string;
    claim_status: string;
    visibility_state: string;
    name: string;
    headline: string;
    linkedin: string | null;
    site: string | null;
    summary: string | null;
  };
  let existingProfile: ExistingProfile | null = null;
  if (existingEntityId) {
    const { data, error } = await supabaseAdmin
      .from("founder_profiles")
      .select(
        "id,published,profile_origin,claim_status,visibility_state,name,headline,linkedin,site,summary",
      )
      .eq("graph_entity_id", existingEntityId)
      .maybeSingle();
    if (error) throw error;
    existingProfile = data;
  }

  if (!existingProfile) {
    const { data: candidates, error } = await supabaseAdmin
      .from("founder_profiles")
      .select(
        "id,published,github,profile_origin,claim_status,visibility_state,name,headline,linkedin,site,summary",
      )
      .not("github", "is", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const match = candidates.find(
      (candidate) => parseGitHubLogin(candidate.github ?? "")?.toLowerCase() === login,
    );
    if (match) existingProfile = match;
  }

  const properties = asObject(founder.properties);
  const summary =
    (typeof properties.bio === "string" && properties.bio.trim()) ||
    input.headline.trim() ||
    `Public GitHub evidence for @${login}.`;
  const profileOrigin = input.profileOrigin ?? "founder_submission";
  const claimStatus =
    input.claimStatus ?? (profileOrigin === "public_scan" ? "unclaimed" : "self_submitted");
  const visibilityState =
    input.visibilityState ?? (profileOrigin === "public_scan" ? "discoverable" : "private");
  const protectsFounderSubmission =
    profileOrigin === "public_scan" && existingProfile?.profile_origin === "founder_submission";
  const values = {
    name: protectsFounderSubmission && existingProfile ? existingProfile.name : input.name.trim(),
    headline: protectsFounderSubmission
      ? (existingProfile?.headline ?? "")
      : input.headline.trim() || `Public GitHub profile @${login}`,
    github: typeof properties.githubUrl === "string" ? properties.githubUrl : input.github,
    linkedin:
      protectsFounderSubmission && existingProfile
        ? existingProfile.linkedin
        : input.linkedin || null,
    site: protectsFounderSubmission && existingProfile ? existingProfile.site : input.site || null,
    summary:
      protectsFounderSubmission && existingProfile ? (existingProfile.summary ?? summary) : summary,
    scores: {
      founder_score: null,
      founder_score_status: "insufficient_evidence",
      evidence_model: "github_graph_v1",
    },
  };

  if (existingProfile) {
    const provenance = {
      profile_origin: existingProfile.profile_origin,
      claim_status:
        profileOrigin === "founder_submission" && existingProfile.claim_status === "unclaimed"
          ? "self_submitted"
          : existingProfile.claim_status,
      visibility_state: existingProfile.published
        ? "published"
        : existingProfile.visibility_state === "discoverable" || visibilityState === "discoverable"
          ? "discoverable"
          : visibilityState,
    };
    const { data, error } = await supabaseAdmin
      .from("founder_profiles")
      .update({ ...values, ...provenance })
      .eq("id", existingProfile.id)
      .select("id,published")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("founder_profiles")
    .insert({
      ...values,
      profile_origin: profileOrigin,
      claim_status: claimStatus,
      visibility_state: visibilityState,
    })
    .select("id,published")
    .single();
  if (error) throw error;
  return data;
}

export async function replaceLegacyFounderSignals(
  profileId: string,
  signals: Array<{
    source: string;
    kind: string;
    title: string;
    detail?: string;
    weight: number;
    evidence_url?: string;
  }>,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: deleteError } = await supabaseAdmin
    .from("founder_signals")
    .delete()
    .eq("profile_id", profileId);
  if (deleteError) throw deleteError;
  if (signals.length === 0) return;
  const { error: insertError } = await supabaseAdmin.from("founder_signals").insert(
    signals.map((signal) => ({
      profile_id: profileId,
      source: signal.source,
      kind: signal.kind,
      title: signal.title,
      detail: signal.detail ?? null,
      weight: signal.weight,
      evidence_url: signal.evidence_url ?? null,
    })),
  );
  if (insertError) throw insertError;
}
