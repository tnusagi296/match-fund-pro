import type { Json } from "@/integrations/supabase/types";
import type {
  EvidenceConfidence,
  GraphEvidenceRecord,
  GraphEvidenceReference,
  GraphFounderCard,
  GraphProjectionSnapshot,
  GraphRelationshipRecord,
  GraphSignal,
  TrustLevel,
} from "./types";

function objectValue(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value: Json | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function trustFromConfidence(confidence: number): TrustLevel {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  if (confidence > 0) return "low";
  return "unknown";
}

function sourceName(evidence: GraphEvidenceRecord): string {
  const metadata = objectValue(evidence.metadata);
  return stringValue(metadata.sourceName) ?? "GitHub";
}

function relationshipEvidence(
  snapshot: GraphProjectionSnapshot,
  relationship: GraphRelationshipRecord,
  evidenceById: Map<string, GraphEvidenceRecord>,
): GraphEvidenceRecord | null {
  const link = snapshot.relationshipEvidence.find(
    (item) => item.relationshipId === relationship.id,
  );
  return link ? (evidenceById.get(link.evidenceId) ?? null) : null;
}

function makeReference(
  relationship: GraphRelationshipRecord,
  evidence: GraphEvidenceRecord,
  values: Pick<GraphEvidenceReference, "kind" | "value" | "repositoryName" | "graphStep">,
): GraphEvidenceReference {
  return {
    id: `${relationship.id}:${evidence.id}:${values.kind}:${values.value}`,
    ...values,
    evidenceExcerpt: evidence.excerpt,
    sourceName: sourceName(evidence),
    sourceUrl: evidence.sourceUrl,
    trustLevel: trustFromConfidence(Math.min(relationship.confidence, evidence.reliability)),
    observedAt: relationship.observedAt,
  };
}

function evidenceConfidence(
  snapshot: GraphProjectionSnapshot,
  repositoryIds: Set<string>,
): EvidenceConfidence {
  const evidenceByClaim = new Set(snapshot.claimEvidence.map((link) => link.claimId));
  const supported = snapshot.claims.filter(
    (claim) =>
      claim.status === "supported" &&
      evidenceByClaim.has(claim.id) &&
      (repositoryIds.has(claim.subjectEntityId) ||
        claim.subjectEntityId === snapshot.profile.graphEntityId),
  );
  const repositorySubjects = new Set(
    supported
      .filter((claim) => repositoryIds.has(claim.subjectEntityId))
      .map((claim) => claim.subjectEntityId),
  );
  if (supported.length >= 4 && repositorySubjects.size >= 2) return "High";

  const reliableRepositoryEvidence = snapshot.relationships.some((relationship) => {
    if (relationship.relationshipType !== "OWNS_REPOSITORY") return false;
    const link = snapshot.relationshipEvidence.find(
      (item) => item.relationshipId === relationship.id,
    );
    const evidence = link && snapshot.evidence.find((item) => item.id === link.evidenceId);
    return Boolean(evidence && evidence.reliability >= 0.8);
  });
  if (reliableRepositoryEvidence && supported.length > 0) return "Medium";
  if (snapshot.claims.some((claim) => claim.status === "self_reported")) return "Low";
  return "Unknown";
}

export function projectFounderCard(snapshot: GraphProjectionSnapshot): GraphFounderCard {
  const founder = snapshot.entities.find((entity) => entity.id === snapshot.profile.graphEntityId);
  if (!founder || founder.entityType !== "founder") {
    throw new Error(`Founder graph entity ${snapshot.profile.graphEntityId} is missing.`);
  }

  const entitiesById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const evidenceById = new Map(snapshot.evidence.map((item) => [item.id, item]));
  const ownership = snapshot.relationships.filter(
    (relationship) =>
      relationship.sourceEntityId === founder.id &&
      relationship.relationshipType === "OWNS_REPOSITORY",
  );
  const repositoryIds = new Set(ownership.map((relationship) => relationship.targetEntityId));
  const repositories = ownership
    .map((relationship) => entitiesById.get(relationship.targetEntityId))
    .filter((entity): entity is NonNullable<typeof entity> => entity?.entityType === "repository");

  const languageCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const references: GraphEvidenceReference[] = [];

  const profileRelationship = snapshot.relationships.find(
    (relationship) =>
      relationship.sourceEntityId === founder.id && relationship.relationshipType === "HAS_PROFILE",
  );
  const founderProperties = objectValue(founder.properties);
  const location = stringValue(founderProperties.location);
  if (profileRelationship) {
    const evidence = relationshipEvidence(snapshot, profileRelationship, evidenceById);
    if (evidence) {
      references.push(
        makeReference(profileRelationship, evidence, {
          kind: "profile",
          value: location ?? stringValue(founderProperties.githubLogin) ?? snapshot.profile.name,
          repositoryName: null,
          graphStep: "Founder HAS_PROFILE on GitHub",
        }),
      );
    }
  }

  for (const relationship of ownership) {
    const repository = entitiesById.get(relationship.targetEntityId);
    const evidence = relationshipEvidence(snapshot, relationship, evidenceById);
    if (!repository || !evidence) continue;
    references.push(
      makeReference(relationship, evidence, {
        kind: "repository_ownership",
        value: repository.canonicalName,
        repositoryName: repository.canonicalName,
        graphStep: `Founder OWNS_REPOSITORY ${repository.canonicalName} (GitHub owner ID match)`,
      }),
    );
  }

  const repositoryRelationships = snapshot.relationships.filter((relationship) =>
    repositoryIds.has(relationship.sourceEntityId),
  );
  for (const relationship of repositoryRelationships) {
    const target = entitiesById.get(relationship.targetEntityId);
    const repository = entitiesById.get(relationship.sourceEntityId);
    if (!target || !repository) continue;
    const evidence = relationshipEvidence(snapshot, relationship, evidenceById);
    if (relationship.relationshipType === "USES_LANGUAGE" && target.entityType === "skill") {
      languageCounts.set(target.canonicalName, (languageCounts.get(target.canonicalName) ?? 0) + 1);
      if (evidence) {
        references.push(
          makeReference(relationship, evidence, {
            kind: "language",
            value: target.canonicalName,
            repositoryName: repository.canonicalName,
            graphStep: `${repository.canonicalName} USES_LANGUAGE ${target.canonicalName}`,
          }),
        );
      }
    }
    if (relationship.relationshipType === "FOCUSES_ON" && target.entityType === "sector") {
      topicCounts.set(target.canonicalName, (topicCounts.get(target.canonicalName) ?? 0) + 1);
      if (evidence) {
        references.push(
          makeReference(relationship, evidence, {
            kind: "topic",
            value: target.canonicalName,
            repositoryName: repository.canonicalName,
            graphStep: `${repository.canonicalName} FOCUSES_ON ${target.canonicalName}`,
          }),
        );
      }
    }
  }

  const activityClaims = snapshot.claims
    .filter(
      (claim) =>
        repositoryIds.has(claim.subjectEntityId) &&
        claim.predicate === "repository_last_pushed_at" &&
        claim.status === "supported" &&
        typeof claim.value === "string",
    )
    .sort((a, b) => String(b.value).localeCompare(String(a.value)));
  for (const claim of activityClaims) {
    const link = snapshot.claimEvidence.find((item) => item.claimId === claim.id);
    const evidence = link ? evidenceById.get(link.evidenceId) : null;
    const repository = entitiesById.get(claim.subjectEntityId);
    if (!evidence || !repository || typeof claim.value !== "string") continue;
    references.push({
      id: `${claim.id}:${evidence.id}:recent_activity`,
      kind: "recent_activity",
      value: claim.value,
      repositoryName: repository.canonicalName,
      graphStep: `${repository.canonicalName} has repository_last_pushed_at ${claim.value.slice(0, 10)}`,
      evidenceExcerpt: evidence.excerpt,
      sourceName: sourceName(evidence),
      sourceUrl: evidence.sourceUrl,
      trustLevel: claim.trustLevel,
      observedAt: claim.observedAt,
    });
  }

  const mainLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([language]) => language)
    .slice(0, 5);
  const topics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([topic]) => topic)
    .slice(0, 8);
  const recentActivityAt = activityClaims[0]?.value;

  const repositoryText = repositories.flatMap((repository) => {
    const properties = objectValue(repository.properties);
    return [
      repository.canonicalName,
      stringValue(properties.description),
      stringValue(properties.language),
      ...stringArray(properties.topics),
    ].filter((value): value is string => Boolean(value));
  });

  const topSignals: GraphSignal[] = [];
  if (ownership.length > 0) {
    const reference = references.find((item) => item.kind === "repository_ownership");
    topSignals.push({
      title: `${ownership.length} public ${ownership.length === 1 ? "repository" : "repositories"}`,
      detail:
        "Ownership is based on matching GitHub owner IDs; it does not claim personal authorship.",
      trustLevel: reference?.trustLevel ?? "unknown",
      evidenceId: reference?.id ?? null,
    });
  }
  if (mainLanguages.length > 0) {
    const reference = references.find((item) => item.kind === "language");
    topSignals.push({
      title: `Main languages: ${mainLanguages.slice(0, 3).join(", ")}`,
      detail: "Derived from GitHub primary-language metadata across owned repositories.",
      trustLevel: reference?.trustLevel ?? "unknown",
      evidenceId: reference?.id ?? null,
    });
  }
  if (topics.length > 0) {
    const reference = references.find((item) => item.kind === "topic");
    topSignals.push({
      title: `Repository topics: ${topics.slice(0, 3).join(", ")}`,
      detail: "Topics are repository metadata, not inferred psychological attributes.",
      trustLevel: reference?.trustLevel ?? "unknown",
      evidenceId: reference?.id ?? null,
    });
  } else if (typeof recentActivityAt === "string") {
    const reference = references.find((item) => item.kind === "recent_activity");
    topSignals.push({
      title: `Recent repository activity: ${recentActivityAt.slice(0, 10)}`,
      detail: "Latest supported repository push timestamp.",
      trustLevel: reference?.trustLevel ?? "unknown",
      evidenceId: reference?.id ?? null,
    });
  }

  const unknowns: string[] = [];
  if (!location) unknowns.push("Geography was not provided by the founder or GitHub profile.");
  unknowns.push("Company stage was not provided in this flow.");
  if (topics.length === 0) unknowns.push("No repository topics are available for sector matching.");
  if (!recentActivityAt) unknowns.push("No usable repository activity timestamp is available.");
  unknowns.push("Founder Score has insufficient evidence and is not calculated.");

  const uniqueReferences = [
    ...new Map(references.map((reference) => [reference.id, reference])).values(),
  ];
  const sourceCount = new Set(uniqueReferences.map((reference) => reference.sourceUrl)).size;

  return {
    kind: "graph",
    id: snapshot.profile.id,
    graphEntityId: founder.id,
    name: snapshot.profile.name || founder.canonicalName,
    headline: snapshot.profile.headline,
    summary:
      snapshot.profile.summary ??
      stringValue(founderProperties.bio) ??
      `Graph-backed GitHub evidence for ${founder.canonicalName}.`,
    avatarUrl: stringValue(founderProperties.avatarUrl),
    location,
    stage: stringValue(founderProperties.stage),
    githubUrl: snapshot.profile.github ?? stringValue(founderProperties.githubUrl),
    repositoryCount: ownership.length,
    mainLanguages,
    topics,
    recentActivityAt: typeof recentActivityAt === "string" ? recentActivityAt : null,
    sourceCount,
    evidenceConfidence: evidenceConfidence(snapshot, repositoryIds),
    topSignals: topSignals.slice(0, 3),
    evidenceReferences: uniqueReferences,
    repositoryText,
    unknowns,
    founderScoreLabel: "Insufficient evidence",
  };
}
