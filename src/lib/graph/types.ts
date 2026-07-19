import type { Json } from "@/integrations/supabase/types";

export type GraphEntityType =
  | "founder"
  | "person"
  | "repository"
  | "project"
  | "hackathon"
  | "organization"
  | "company"
  | "accelerator"
  | "accelerator_cohort"
  | "legal_entity"
  | "registration"
  | "website"
  | "social_account"
  | "skill"
  | "sector"
  | "source";

export type GraphIdentifierScheme =
  | "github_user_id"
  | "github_login"
  | "github_repo_id"
  | "github_repo_full_name"
  | "matchfund_profile_id"
  | "canonical_url"
  | "project_url"
  | "hackathon_url"
  | "organization_url"
  | "source_external_id"
  | "personal_website_url"
  | "company_website_url"
  | "company_domain"
  | "linkedin_url"
  | "reddit_url"
  | "accelerator_company_url"
  | "accelerator_cohort_url"
  | "euid"
  | "german_register_key";

export type GraphRelationshipType =
  | "HAS_PROFILE"
  | "OWNS_REPOSITORY"
  | "BUILT"
  | "USES_LANGUAGE"
  | "USES_TECHNOLOGY"
  | "FOCUSES_ON"
  | "SUPPORTED_BY"
  | "PARTICIPATED_IN"
  | "CONTRIBUTED_TO"
  | "SUBMITTED_TO"
  | "ORGANIZED"
  | "WON_AT"
  | "FINALIST_AT"
  | "RECEIVED_PRIZE_AT"
  | "FOUNDED"
  | "OPERATED_BY"
  | "ACCELERATED_BY"
  | "HAS_WEBSITE"
  | "HAS_SOCIAL_IDENTIFIER"
  | "MANAGING_DIRECTOR_OF"
  | "SHAREHOLDER_OF"
  | "REGISTERED_REPRESENTATIVE_OF";

export type GraphClaimStatus = "supported" | "self_reported" | "unknown" | "contradicted";
export type TrustLevel = "high" | "medium" | "low" | "unknown";
export type EvidenceConfidence = "High" | "Medium" | "Low" | "Unknown";
export type ProfileOrigin = "public_scan" | "founder_submission" | "demo";
export type ProfileClaimStatus = "unclaimed" | "self_submitted" | "claimed";
export type ProfileVisibilityState = "private" | "discoverable" | "published";

export type GraphIdentifierInput = {
  scheme: GraphIdentifierScheme;
  value: string;
};

export type GraphEntityInput = {
  tempId: string;
  entityType: GraphEntityType;
  canonicalKey: string;
  canonicalName: string;
  properties: Json;
  identifiers: GraphIdentifierInput[];
};

export type GraphEvidenceInput = {
  tempId: string;
  sourceType: string;
  sourceUrl: string;
  sourceExternalId: string | null;
  retrievedAt: string;
  excerpt: string;
  rawPayload: Json;
  contentHash: string;
  reliability: number;
  pageTitle: string | null;
  extractionMethod: string;
  trustLevel: TrustLevel | "self_reported";
  metadata: Json;
};

export type GraphRelationshipInput = {
  tempId: string;
  sourceTempId: string;
  targetTempId: string;
  relationshipType: GraphRelationshipType;
  confidence: number;
  observedAt: string;
  validFrom: string | null;
  validTo: string | null;
  properties: Json;
  evidenceTempIds: string[];
};

export type GraphClaimInput = {
  tempId: string;
  subjectTempId: string;
  predicate: string;
  value: Json;
  status: GraphClaimStatus;
  trustLevel: TrustLevel;
  observedAt: string;
  evidenceTempIds: string[];
};

export type GraphIngestionResult = {
  entities: GraphEntityInput[];
  relationships: GraphRelationshipInput[];
  claims: GraphClaimInput[];
  evidence: GraphEvidenceInput[];
};

export type GraphIngestionSummary = {
  repositoriesFound: number;
  projectsFound: number;
  hackathonsFound: number;
  organizationsFound: number;
  entitiesCreated: number;
  evidenceCreated: number;
  relationshipsCreated: number;
  claimsCreated: number;
  claimsSupported: number;
  lastUpdated: string;
};

export type GraphPersistenceResult = {
  founderEntityId: string;
  profileId: string;
  summary: GraphIngestionSummary;
};

export type GraphFragmentPersistenceResult = {
  entityIds: Record<string, string>;
  evidenceIds: Record<string, string>;
  summary: GraphIngestionSummary;
};

export type GraphEntityRecord = {
  id: string;
  entityType: GraphEntityType;
  canonicalKey: string;
  canonicalName: string;
  properties: Json;
  updatedAt: string;
};

export type GraphEvidenceRecord = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  sourceExternalId: string | null;
  retrievedAt: string;
  excerpt: string;
  reliability: number;
  pageTitle: string | null;
  extractionMethod: string;
  trustLevel: TrustLevel | "self_reported";
  metadata: Json;
};

export type GraphRelationshipRecord = {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: GraphRelationshipType;
  confidence: number;
  observedAt: string;
  properties: Json;
};

export type GraphClaimRecord = {
  id: string;
  subjectEntityId: string;
  predicate: string;
  value: Json;
  status: GraphClaimStatus;
  trustLevel: TrustLevel;
  observedAt: string;
};

export type FounderProfileRecord = {
  id: string;
  graphEntityId: string;
  name: string;
  headline: string;
  github: string | null;
  linkedin: string | null;
  site: string | null;
  summary: string | null;
  updatedAt: string;
  profileOrigin: ProfileOrigin;
  claimStatus: ProfileClaimStatus;
  visibilityState: ProfileVisibilityState;
};

export type GraphProjectionSnapshot = {
  profile: FounderProfileRecord;
  entities: GraphEntityRecord[];
  relationships: GraphRelationshipRecord[];
  claims: GraphClaimRecord[];
  evidence: GraphEvidenceRecord[];
  relationshipEvidence: Array<{ relationshipId: string; evidenceId: string }>;
  claimEvidence: Array<{ claimId: string; evidenceId: string }>;
  discoveryProvenance?: DiscoveryProvenance[];
};

export type GraphSignal = {
  title: string;
  detail: string;
  trustLevel: TrustLevel;
  evidenceId: string | null;
};

export type GraphEvidenceReference = {
  id: string;
  kind:
    | "profile"
    | "repository_ownership"
    | "language"
    | "topic"
    | "recent_activity"
    | "hackathon_participation"
    | "project_contribution"
    | "project_submission"
    | "hackathon_result"
    | "project_technology"
    | "hackathon_organizer"
    | "company_founder"
    | "accelerator_participation"
    | "website_profile"
    | "website_technology"
    | "legal_role";
  value: string;
  repositoryName: string | null;
  entityName: string | null;
  graphStep: string;
  supportStatus: GraphClaimStatus;
  evidenceExcerpt: string;
  sourceName: string;
  sourceUrl: string;
  trustLevel: TrustLevel;
  observedAt: string;
};

export type GraphHackathonSummary = {
  entityId: string;
  name: string;
  url: string | null;
  startDate: string | null;
  endDate: string | null;
  organizer: string | null;
  participationTrust: TrustLevel;
};

export type GraphProjectSummary = {
  entityId: string;
  name: string;
  url: string | null;
  description: string | null;
  eventName: string | null;
  role: string | null;
  contributionTrust: TrustLevel;
  resultType: "participant" | "finalist" | "winner" | "prize" | "unknown";
  resultLabel: string | null;
  resultTrust: TrustLevel;
  technologies: string[];
};

export type GraphFounderCard = {
  kind: "graph";
  id: string;
  graphEntityId: string;
  name: string;
  headline: string;
  summary: string;
  avatarUrl: string | null;
  location: string | null;
  stage: string | null;
  githubUrl: string | null;
  repositoryCount: number;
  mainLanguages: string[];
  topics: string[];
  recentActivityAt: string | null;
  sourceCount: number;
  evidenceConfidence: EvidenceConfidence;
  topSignals: GraphSignal[];
  evidenceReferences: GraphEvidenceReference[];
  repositoryText: string[];
  hackathons: GraphHackathonSummary[];
  projects: GraphProjectSummary[];
  verifiedResults: string[];
  roles: string[];
  technologies: string[];
  unsupportedClaims: string[];
  unknowns: string[];
  founderScoreLabel: "Insufficient evidence";
  profileOrigin: ProfileOrigin;
  claimStatus: ProfileClaimStatus;
  visibilityState: ProfileVisibilityState;
  discoveryProvenance: DiscoveryProvenance[];
};

export type DiscoveryProvenance = {
  source: "github" | "hackathon" | "accelerator" | "german_register";
  sourceUrl: string;
  introducedAt: string;
  reasons: Array<{
    query: string;
    reason: string;
  }>;
};

export type EvidencePath = {
  criterion: string;
  graphStep: string;
  evidenceExcerpt: string;
  sourceName: string;
  sourceUrl: string;
  trustLevel: TrustLevel;
  observedAt: string;
};

export type ThesisFitResult = {
  score: number;
  matchedCriteria: string[];
  unknownCriteria: string[];
  evidencePaths: EvidencePath[];
};

export type RankedGraphFounder = {
  founder: GraphFounderCard;
  thesisFit: ThesisFitResult;
  discoveryPriority: number;
};
