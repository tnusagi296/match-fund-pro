-- MatchFund hackathon/project evidence extension.
-- Conceptual entity names are uppercase in product documentation; persisted
-- values remain lowercase to match the existing graph convention.

ALTER TABLE public.graph_entities
  DROP CONSTRAINT IF EXISTS graph_entities_entity_type_check;

ALTER TABLE public.graph_entities
  ADD CONSTRAINT graph_entities_entity_type_check CHECK (
    entity_type IN (
      'founder',
      'repository',
      'project',
      'hackathon',
      'organization',
      'skill',
      'sector',
      'source'
    )
  );

ALTER TABLE public.graph_entity_identifiers
  DROP CONSTRAINT IF EXISTS graph_entity_identifiers_scheme_check;

ALTER TABLE public.graph_entity_identifiers
  ADD CONSTRAINT graph_entity_identifiers_scheme_check CHECK (
    scheme IN (
      'github_user_id',
      'github_login',
      'github_repo_id',
      'github_repo_full_name',
      'matchfund_profile_id',
      'canonical_url',
      'project_url',
      'hackathon_url',
      'organization_url',
      'source_external_id'
    )
  );

ALTER TABLE public.graph_relationships
  DROP CONSTRAINT IF EXISTS graph_relationships_relationship_type_check;

ALTER TABLE public.graph_relationships
  ADD CONSTRAINT graph_relationships_relationship_type_check CHECK (
    relationship_type IN (
      'HAS_PROFILE',
      'OWNS_REPOSITORY',
      'BUILT',
      'USES_LANGUAGE',
      'USES_TECHNOLOGY',
      'FOCUSES_ON',
      'SUPPORTED_BY',
      'PARTICIPATED_IN',
      'CONTRIBUTED_TO',
      'SUBMITTED_TO',
      'ORGANIZED',
      'WON_AT',
      'FINALIST_AT',
      'RECEIVED_PRIZE_AT'
    )
  );

ALTER TABLE public.graph_evidence
  ADD COLUMN page_title text,
  ADD COLUMN extraction_method text NOT NULL DEFAULT 'source_adapter',
  ADD COLUMN trust_level text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.graph_evidence
  ADD CONSTRAINT graph_evidence_trust_level_check CHECK (
    trust_level IN ('high', 'medium', 'low', 'unknown', 'self_reported')
  );

COMMENT ON COLUMN public.graph_evidence.page_title IS
  'Public source page title captured at observation time.';
COMMENT ON COLUMN public.graph_evidence.extraction_method IS
  'Deterministic metadata/text extraction, validated AI proposal, API adapter, or founder submission.';
COMMENT ON COLUMN public.graph_evidence.trust_level IS
  'Trust classification of this evidence record; claim and relationship status remain separate.';
