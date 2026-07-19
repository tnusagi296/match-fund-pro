import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { projectFounderCard } from "./projection";
import type {
  GraphClaimRecord,
  GraphEntityRecord,
  GraphEvidenceRecord,
  GraphFounderCard,
  GraphProjectionSnapshot,
  GraphRelationshipRecord,
} from "./types";

function assertNoError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`Graph feed ${operation} failed: ${error.message}`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export async function loadPublishedGraphFounderCards(
  injectedClient?: SupabaseClient<Database>,
): Promise<GraphFounderCard[]> {
  const client =
    injectedClient ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  const { data: profiles, error: profileError } = await client
    .from("founder_profiles")
    .select("id,graph_entity_id,name,headline,github,linkedin,site,summary,updated_at")
    .eq("published", true)
    .not("graph_entity_id", "is", null)
    .order("updated_at", { ascending: false });
  assertNoError(profileError, "profile query");
  if (!profiles || profiles.length === 0) return [];

  const founderIds = profiles
    .map((profile) => profile.graph_entity_id)
    .filter((id): id is string => Boolean(id));
  const { data: founderRelationships, error: founderRelationshipError } = await client
    .from("graph_relationships")
    .select(
      "id,source_entity_id,target_entity_id,relationship_type,confidence,observed_at,properties",
    )
    .in("source_entity_id", founderIds);
  assertNoError(founderRelationshipError, "founder relationship query");

  const firstHopEntityIds = unique(
    (founderRelationships ?? []).map((relationship) => relationship.target_entity_id),
  );
  let secondHopRelationships: NonNullable<typeof founderRelationships> = [];
  if (firstHopEntityIds.length > 0) {
    const result = await client
      .from("graph_relationships")
      .select(
        "id,source_entity_id,target_entity_id,relationship_type,confidence,observed_at,properties",
      )
      .in("source_entity_id", firstHopEntityIds);
    assertNoError(result.error, "second-hop relationship query");
    secondHopRelationships = result.data ?? [];
  }

  const hackathonIds = unique([
    ...(founderRelationships ?? [])
      .filter((relationship) => relationship.relationship_type === "PARTICIPATED_IN")
      .map((relationship) => relationship.target_entity_id),
    ...secondHopRelationships
      .filter((relationship) =>
        ["SUBMITTED_TO", "WON_AT", "FINALIST_AT", "RECEIVED_PRIZE_AT"].includes(
          relationship.relationship_type,
        ),
      )
      .map((relationship) => relationship.target_entity_id),
  ]);
  let organizerRelationships: NonNullable<typeof founderRelationships> = [];
  if (hackathonIds.length > 0) {
    const result = await client
      .from("graph_relationships")
      .select(
        "id,source_entity_id,target_entity_id,relationship_type,confidence,observed_at,properties",
      )
      .eq("relationship_type", "ORGANIZED")
      .in("target_entity_id", hackathonIds);
    assertNoError(result.error, "organizer relationship query");
    organizerRelationships = result.data ?? [];
  }

  const relationshipRows = [
    ...(founderRelationships ?? []),
    ...secondHopRelationships,
    ...organizerRelationships,
  ];
  const entityIds = unique([
    ...founderIds,
    ...relationshipRows.flatMap((relationship) => [
      relationship.source_entity_id,
      relationship.target_entity_id,
    ]),
  ]);
  const { data: entityRows, error: entityError } = await client
    .from("graph_entities")
    .select("id,entity_type,canonical_key,canonical_name,properties,updated_at")
    .in("id", entityIds);
  assertNoError(entityError, "entity query");

  const claimSubjectIds = entityIds;
  const { data: claimRows, error: claimError } = await client
    .from("graph_claims")
    .select("id,subject_entity_id,predicate,value,status,trust_level,observed_at")
    .in("subject_entity_id", claimSubjectIds);
  assertNoError(claimError, "claim query");

  const relationshipIds = relationshipRows.map((relationship) => relationship.id);
  let relationshipEvidenceRows: Array<{ relationship_id: string; evidence_id: string }> = [];
  if (relationshipIds.length > 0) {
    const result = await client
      .from("graph_relationship_evidence")
      .select("relationship_id,evidence_id")
      .in("relationship_id", relationshipIds);
    assertNoError(result.error, "relationship evidence-link query");
    relationshipEvidenceRows = result.data ?? [];
  }

  const claimIds = (claimRows ?? []).map((claim) => claim.id);
  let claimEvidenceRows: Array<{ claim_id: string; evidence_id: string }> = [];
  if (claimIds.length > 0) {
    const result = await client
      .from("graph_claim_evidence")
      .select("claim_id,evidence_id")
      .in("claim_id", claimIds);
    assertNoError(result.error, "claim evidence-link query");
    claimEvidenceRows = result.data ?? [];
  }

  const evidenceIds = unique([
    ...relationshipEvidenceRows.map((link) => link.evidence_id),
    ...claimEvidenceRows.map((link) => link.evidence_id),
  ]);
  let evidenceRows: Array<{
    id: string;
    source_type: string;
    source_url: string;
    source_external_id: string | null;
    retrieved_at: string;
    excerpt: string;
    reliability: number;
    page_title: string | null;
    extraction_method: string;
    trust_level: string;
    metadata: Database["public"]["Tables"]["graph_evidence"]["Row"]["metadata"];
  }> = [];
  if (evidenceIds.length > 0) {
    const result = await client
      .from("graph_evidence")
      .select(
        "id,source_type,source_url,source_external_id,retrieved_at,excerpt,reliability,page_title,extraction_method,trust_level,metadata",
      )
      .in("id", evidenceIds);
    assertNoError(result.error, "evidence query");
    evidenceRows = result.data ?? [];
  }

  const entities: GraphEntityRecord[] = (entityRows ?? []).map((entity) => ({
    id: entity.id,
    entityType: entity.entity_type as GraphEntityRecord["entityType"],
    canonicalKey: entity.canonical_key,
    canonicalName: entity.canonical_name,
    properties: entity.properties,
    updatedAt: entity.updated_at,
  }));
  const relationships: GraphRelationshipRecord[] = relationshipRows.map((relationship) => ({
    id: relationship.id,
    sourceEntityId: relationship.source_entity_id,
    targetEntityId: relationship.target_entity_id,
    relationshipType: relationship.relationship_type as GraphRelationshipRecord["relationshipType"],
    confidence: relationship.confidence,
    observedAt: relationship.observed_at,
    properties: relationship.properties,
  }));
  const claims: GraphClaimRecord[] = (claimRows ?? []).map((claim) => ({
    id: claim.id,
    subjectEntityId: claim.subject_entity_id,
    predicate: claim.predicate,
    value: claim.value,
    status: claim.status as GraphClaimRecord["status"],
    trustLevel: claim.trust_level as GraphClaimRecord["trustLevel"],
    observedAt: claim.observed_at,
  }));
  const evidence: GraphEvidenceRecord[] = evidenceRows.map((item) => ({
    id: item.id,
    sourceType: item.source_type,
    sourceUrl: item.source_url,
    sourceExternalId: item.source_external_id,
    retrievedAt: item.retrieved_at,
    excerpt: item.excerpt,
    reliability: item.reliability,
    pageTitle: item.page_title,
    extractionMethod: item.extraction_method,
    trustLevel: item.trust_level as GraphEvidenceRecord["trustLevel"],
    metadata: item.metadata,
  }));

  return profiles.flatMap((profile) => {
    if (!profile.graph_entity_id) return [];
    const directTargetIds = new Set(
      relationships
        .filter((relationship) => relationship.sourceEntityId === profile.graph_entity_id)
        .map((relationship) => relationship.targetEntityId),
    );
    const outboundRelationships = relationships.filter(
      (relationship) =>
        relationship.sourceEntityId === profile.graph_entity_id ||
        directTargetIds.has(relationship.sourceEntityId),
    );
    const relevantHackathonIds = new Set(
      outboundRelationships
        .filter((relationship) =>
          [
            "PARTICIPATED_IN",
            "SUBMITTED_TO",
            "WON_AT",
            "FINALIST_AT",
            "RECEIVED_PRIZE_AT",
          ].includes(relationship.relationshipType),
        )
        .map((relationship) => relationship.targetEntityId),
    );
    const relevantRelationships = relationships.filter(
      (relationship) =>
        outboundRelationships.includes(relationship) ||
        (relationship.relationshipType === "ORGANIZED" &&
          relevantHackathonIds.has(relationship.targetEntityId)),
    );
    const relevantRelationshipIds = new Set(
      relevantRelationships.map((relationship) => relationship.id),
    );
    const relevantEntityIds = new Set([
      profile.graph_entity_id,
      ...relevantRelationships.flatMap((relationship) => [
        relationship.sourceEntityId,
        relationship.targetEntityId,
      ]),
    ]);
    const relevantClaims = claims.filter((claim) => relevantEntityIds.has(claim.subjectEntityId));
    const relevantClaimIds = new Set(relevantClaims.map((claim) => claim.id));
    const relevantRelationshipEvidence = relationshipEvidenceRows.filter((link) =>
      relevantRelationshipIds.has(link.relationship_id),
    );
    const relevantClaimEvidence = claimEvidenceRows.filter((link) =>
      relevantClaimIds.has(link.claim_id),
    );
    const relevantEvidenceIds = new Set([
      ...relevantRelationshipEvidence.map((link) => link.evidence_id),
      ...relevantClaimEvidence.map((link) => link.evidence_id),
    ]);

    const snapshot: GraphProjectionSnapshot = {
      profile: {
        id: profile.id,
        graphEntityId: profile.graph_entity_id,
        name: profile.name,
        headline: profile.headline,
        github: profile.github,
        linkedin: profile.linkedin,
        site: profile.site,
        summary: profile.summary,
        updatedAt: profile.updated_at,
      },
      entities: entities.filter((entity) => relevantEntityIds.has(entity.id)),
      relationships: relevantRelationships,
      claims: relevantClaims,
      evidence: evidence.filter((item) => relevantEvidenceIds.has(item.id)),
      relationshipEvidence: relevantRelationshipEvidence.map((link) => ({
        relationshipId: link.relationship_id,
        evidenceId: link.evidence_id,
      })),
      claimEvidence: relevantClaimEvidence.map((link) => ({
        claimId: link.claim_id,
        evidenceId: link.evidence_id,
      })),
    };

    return [projectFounderCard(snapshot)];
  });
}
