import type { Json } from "@/integrations/supabase/types";
import type {
  EvidenceConfidence,
  GraphEvidenceRecord,
  GraphEvidenceReference,
  GraphFounderCard,
  GraphProjectSummary,
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
  return stringValue(metadata.sourceName) ?? evidence.pageTitle ?? "Public source";
}

function relationshipStatus(relationship: GraphRelationshipRecord) {
  const properties = objectValue(relationship.properties);
  const value = stringValue(properties.verificationStatus);
  return value === "self_reported" || value === "unknown" || value === "contradicted"
    ? value
    : "supported";
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
  values: Pick<GraphEvidenceReference, "kind" | "value" | "repositoryName" | "graphStep"> & {
    entityName?: string | null;
  },
): GraphEvidenceReference {
  return {
    id: `${relationship.id}:${evidence.id}:${values.kind}:${values.value}`,
    ...values,
    entityName: values.entityName ?? values.repositoryName,
    supportStatus: relationshipStatus(relationship),
    evidenceExcerpt: evidence.excerpt,
    sourceName: sourceName(evidence),
    sourceUrl: evidence.sourceUrl,
    trustLevel: trustFromConfidence(Math.min(relationship.confidence, evidence.reliability)),
    observedAt: relationship.observedAt,
  };
}

function evidenceConfidence(
  snapshot: GraphProjectionSnapshot,
  evidenceSubjectIds: Set<string>,
): EvidenceConfidence {
  const evidenceByClaim = new Set(snapshot.claimEvidence.map((link) => link.claimId));
  const supported = snapshot.claims.filter(
    (claim) =>
      claim.status === "supported" &&
      evidenceByClaim.has(claim.id) &&
      (evidenceSubjectIds.has(claim.subjectEntityId) ||
        claim.subjectEntityId === snapshot.profile.graphEntityId),
  );
  const supportedSubjects = new Set(
    supported
      .filter((claim) => evidenceSubjectIds.has(claim.subjectEntityId))
      .map((claim) => claim.subjectEntityId),
  );
  if (supported.length >= 4 && supportedSubjects.size >= 2) return "High";

  const reliablePublicEvidence = snapshot.relationships.some((relationship) => {
    if (
      !["OWNS_REPOSITORY", "CONTRIBUTED_TO", "SUBMITTED_TO"].includes(
        relationship.relationshipType,
      ) ||
      relationshipStatus(relationship) !== "supported"
    )
      return false;
    const link = snapshot.relationshipEvidence.find(
      (item) => item.relationshipId === relationship.id,
    );
    const evidence = link && snapshot.evidence.find((item) => item.id === link.evidenceId);
    return Boolean(evidence && evidence.reliability >= 0.8);
  });
  if (reliablePublicEvidence && supported.length > 0) return "Medium";
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
      entityName: repository.canonicalName,
      graphStep: `${repository.canonicalName} has repository_last_pushed_at ${claim.value.slice(0, 10)}`,
      supportStatus: claim.status,
      evidenceExcerpt: evidence.excerpt,
      sourceName: sourceName(evidence),
      sourceUrl: evidence.sourceUrl,
      trustLevel: claim.trustLevel,
      observedAt: claim.observedAt,
    });
  }

  const contributions = snapshot.relationships.filter(
    (relationship) =>
      relationship.sourceEntityId === founder.id &&
      relationship.relationshipType === "CONTRIBUTED_TO",
  );
  const participations = snapshot.relationships.filter(
    (relationship) =>
      relationship.sourceEntityId === founder.id &&
      relationship.relationshipType === "PARTICIPATED_IN",
  );
  const projectIds = new Set(contributions.map((relationship) => relationship.targetEntityId));
  const projectRelationships = snapshot.relationships.filter((relationship) =>
    projectIds.has(relationship.sourceEntityId),
  );
  const hackathonIds = new Set([
    ...participations.map((relationship) => relationship.targetEntityId),
    ...projectRelationships
      .filter((relationship) =>
        ["SUBMITTED_TO", "WON_AT", "FINALIST_AT", "RECEIVED_PRIZE_AT"].includes(
          relationship.relationshipType,
        ),
      )
      .map((relationship) => relationship.targetEntityId),
  ]);
  const organizationRelationships = snapshot.relationships.filter(
    (relationship) =>
      relationship.relationshipType === "ORGANIZED" &&
      hackathonIds.has(relationship.targetEntityId),
  );

  for (const relationship of contributions) {
    const project = entitiesById.get(relationship.targetEntityId);
    const evidence = relationshipEvidence(snapshot, relationship, evidenceById);
    if (!project || !evidence) continue;
    references.push(
      makeReference(relationship, evidence, {
        kind: "project_contribution",
        value: project.canonicalName,
        repositoryName: null,
        entityName: project.canonicalName,
        graphStep: `Founder CONTRIBUTED_TO ${project.canonicalName}`,
      }),
    );
  }

  for (const relationship of participations) {
    const hackathon = entitiesById.get(relationship.targetEntityId);
    const evidence = relationshipEvidence(snapshot, relationship, evidenceById);
    if (!hackathon || !evidence) continue;
    references.push(
      makeReference(relationship, evidence, {
        kind: "hackathon_participation",
        value: hackathon.canonicalName,
        repositoryName: null,
        entityName: hackathon.canonicalName,
        graphStep: `Founder PARTICIPATED_IN ${hackathon.canonicalName}`,
      }),
    );
  }

  for (const relationship of projectRelationships) {
    const project = entitiesById.get(relationship.sourceEntityId);
    const target = entitiesById.get(relationship.targetEntityId);
    const evidence = relationshipEvidence(snapshot, relationship, evidenceById);
    if (!project || !target || !evidence) continue;
    const founderContribution = contributions.find(
      (contribution) => contribution.targetEntityId === relationship.sourceEntityId,
    );
    const withFounderPath = (reference: GraphEvidenceReference) => {
      if (founderContribution && relationshipStatus(founderContribution) !== "supported") {
        return {
          ...reference,
          supportStatus: "self_reported" as const,
          trustLevel: "low" as const,
          graphStep: `Founder CONTRIBUTED_TO ${project.canonicalName} is self-reported → ${reference.graphStep}`,
        };
      }
      return reference;
    };
    if (relationship.relationshipType === "SUBMITTED_TO" && target.entityType === "hackathon") {
      references.push(
        withFounderPath(
          makeReference(relationship, evidence, {
            kind: "project_submission",
            value: `${project.canonicalName} · ${target.canonicalName}`,
            repositoryName: null,
            entityName: project.canonicalName,
            graphStep: `${project.canonicalName} SUBMITTED_TO ${target.canonicalName}`,
          }),
        ),
      );
    }
    if (
      ["WON_AT", "FINALIST_AT", "RECEIVED_PRIZE_AT"].includes(relationship.relationshipType) &&
      target.entityType === "hackathon"
    ) {
      references.push(
        withFounderPath(
          makeReference(relationship, evidence, {
            kind: "hackathon_result",
            value: `${project.canonicalName} · ${target.canonicalName}`,
            repositoryName: null,
            entityName: project.canonicalName,
            graphStep: `${project.canonicalName} ${relationship.relationshipType} ${target.canonicalName}`,
          }),
        ),
      );
    }
    if (relationship.relationshipType === "USES_TECHNOLOGY" && target.entityType === "skill") {
      references.push(
        withFounderPath(
          makeReference(relationship, evidence, {
            kind: "project_technology",
            value: target.canonicalName,
            repositoryName: null,
            entityName: project.canonicalName,
            graphStep: `${project.canonicalName} USES_TECHNOLOGY ${target.canonicalName}`,
          }),
        ),
      );
    }
  }

  for (const relationship of organizationRelationships) {
    const organization = entitiesById.get(relationship.sourceEntityId);
    const hackathon = entitiesById.get(relationship.targetEntityId);
    const evidence = relationshipEvidence(snapshot, relationship, evidenceById);
    if (!organization || !hackathon || !evidence) continue;
    references.push(
      makeReference(relationship, evidence, {
        kind: "hackathon_organizer",
        value: organization.canonicalName,
        repositoryName: null,
        entityName: hackathon.canonicalName,
        graphStep: `${organization.canonicalName} ORGANIZED ${hackathon.canonicalName}`,
      }),
    );
  }

  const hackathons = [...hackathonIds].flatMap((entityId) => {
    const entity = entitiesById.get(entityId);
    if (!entity || entity.entityType !== "hackathon") return [];
    const properties = objectValue(entity.properties);
    const participation = participations.find(
      (relationship) => relationship.targetEntityId === entityId,
    );
    const organizerRelationship = organizationRelationships.find(
      (relationship) => relationship.targetEntityId === entityId,
    );
    const organizer = organizerRelationship
      ? (entitiesById.get(organizerRelationship.sourceEntityId)?.canonicalName ?? null)
      : stringValue(properties.organizer);
    return [
      {
        entityId,
        name: entity.canonicalName,
        url: stringValue(properties.canonicalUrl),
        startDate: stringValue(properties.startDate),
        endDate: stringValue(properties.endDate),
        organizer,
        participationTrust: participation
          ? trustFromConfidence(participation.confidence)
          : ("unknown" as const),
      },
    ];
  });

  const technologies = [
    ...new Set(
      projectRelationships.flatMap((relationship) => {
        if (
          relationship.relationshipType !== "USES_TECHNOLOGY" ||
          relationshipStatus(relationship) !== "supported"
        )
          return [];
        const entity = entitiesById.get(relationship.targetEntityId);
        return entity?.entityType === "skill" ? [entity.canonicalName] : [];
      }),
    ),
  ];
  const projects = contributions.flatMap((contribution) => {
    const entity = entitiesById.get(contribution.targetEntityId);
    if (!entity || entity.entityType !== "project") return [];
    const properties = objectValue(entity.properties);
    const related = projectRelationships.filter(
      (relationship) => relationship.sourceEntityId === entity.id,
    );
    const submission = related.find(
      (relationship) => relationship.relationshipType === "SUBMITTED_TO",
    );
    const result = related.find((relationship) =>
      ["WON_AT", "FINALIST_AT", "RECEIVED_PRIZE_AT"].includes(relationship.relationshipType),
    );
    const event = submission ? entitiesById.get(submission.targetEntityId) : null;
    const contributionProperties = objectValue(contribution.properties);
    const resultProperties = result ? objectValue(result.properties) : {};
    const resultType: GraphProjectSummary["resultType"] =
      result?.relationshipType === "WON_AT"
        ? "winner"
        : result?.relationshipType === "FINALIST_AT"
          ? "finalist"
          : result?.relationshipType === "RECEIVED_PRIZE_AT"
            ? "prize"
            : "unknown";
    const projectTechnologies = related.flatMap((relationship) => {
      if (relationship.relationshipType !== "USES_TECHNOLOGY") return [];
      const technology = entitiesById.get(relationship.targetEntityId);
      return technology?.entityType === "skill" ? [technology.canonicalName] : [];
    });
    return [
      {
        entityId: entity.id,
        name: entity.canonicalName,
        url: stringValue(properties.canonicalUrl),
        description: stringValue(properties.description),
        eventName: event?.canonicalName ?? null,
        role: stringValue(contributionProperties.role),
        contributionTrust: trustFromConfidence(contribution.confidence),
        resultType,
        resultLabel: stringValue(resultProperties.label),
        resultTrust: result ? trustFromConfidence(result.confidence) : ("unknown" as const),
        technologies: [...new Set(projectTechnologies)],
      },
    ];
  });
  const roles = [...new Set(projects.map((project) => project.role).filter(Boolean))] as string[];
  const verifiedResults = projects.flatMap((project) =>
    project.resultType === "unknown"
      ? []
      : [
          `${project.name}: ${project.resultLabel ?? project.resultType}${project.eventName ? ` at ${project.eventName}` : ""}`,
        ],
  );
  const unsupportedClaims = snapshot.claims.flatMap((claim) => {
    if (
      ![founder.id, ...projectIds].includes(claim.subjectEntityId) ||
      !["self_reported", "unknown", "contradicted"].includes(claim.status)
    )
      return [];
    const value = objectValue(claim.value);
    if (claim.predicate === "founder_claimed_project_role") {
      return [
        `Role “${stringValue(value.role) ?? "unknown"}” is ${claim.status.replace("_", " ")}.`,
      ];
    }
    if (claim.predicate === "founder_claimed_hackathon_result") {
      return [
        `Result “${stringValue(value.type) ?? "unknown"}” is ${claim.status.replace("_", " ")}.`,
      ];
    }
    return [];
  });

  const mainLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([language]) => language)
    .slice(0, 5);
  const topics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([topic]) => topic)
    .slice(0, 8);
  const recentActivityAt = activityClaims[0]?.value;

  const repositoryText = [
    ...repositories.flatMap((repository) => {
      const properties = objectValue(repository.properties);
      return [
        repository.canonicalName,
        stringValue(properties.description),
        stringValue(properties.language),
        ...stringArray(properties.topics),
      ].filter((value): value is string => Boolean(value));
    }),
    ...projects
      .filter((project) => ["high", "medium"].includes(project.contributionTrust))
      .flatMap((project) => [
        project.name,
        project.description ?? "",
        project.eventName ?? "",
        ...project.technologies,
      ]),
  ];

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
  if (verifiedResults.length > 0) {
    const reference = references.find(
      (item) => item.kind === "hackathon_result" && item.supportStatus === "supported",
    );
    if (reference) {
      topSignals.push({
        title: verifiedResults[0],
        detail: "The result and founder-to-project path are supported by fetched public sources.",
        trustLevel: reference.trustLevel,
        evidenceId: reference.id,
      });
    }
  }
  if (!topSignals.some((signal) => signal.evidenceId?.includes("hackathon_result"))) {
    const submissionReference = references.find(
      (item) => item.kind === "project_submission" && item.supportStatus === "supported",
    );
    if (submissionReference) {
      topSignals.push({
        title: `Submitted ${submissionReference.value.replace(" · ", " to ")}`,
        detail: "The project-to-hackathon connection is explicit in a public source.",
        trustLevel: submissionReference.trustLevel,
        evidenceId: submissionReference.id,
      });
    }
  }
  if (technologies.length > 0) {
    const reference = references.find(
      (item) => item.kind === "project_technology" && item.supportStatus === "supported",
    );
    if (reference) {
      topSignals.push({
        title: `Project technologies: ${technologies.slice(0, 3).join(", ")}`,
        detail: "The technology and founder-to-project path are supported by public sources.",
        trustLevel: reference.trustLevel,
        evidenceId: reference.id,
      });
    }
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
  if (projects.length === 0) unknowns.push("No hackathon project evidence has been submitted.");
  if (projects.some((project) => !project.role)) {
    unknowns.push("At least one project contribution role remains unknown.");
  }
  if (hackathons.some((hackathon) => !hackathon.organizer)) {
    unknowns.push("At least one event organizer remains unknown.");
  }
  unknowns.push(...unsupportedClaims);
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
    evidenceConfidence: evidenceConfidence(snapshot, new Set([...repositoryIds, ...projectIds])),
    topSignals: topSignals.slice(0, 3),
    evidenceReferences: uniqueReferences,
    repositoryText,
    hackathons,
    projects,
    verifiedResults,
    roles,
    technologies,
    unsupportedClaims,
    unknowns,
    founderScoreLabel: "Insufficient evidence",
  };
}
