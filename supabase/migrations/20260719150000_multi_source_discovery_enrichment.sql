-- MatchFund multi-source discovery and bounded enrichment.
-- This migration only widens the existing relational graph and discovery-run
-- model. Search results remain discovery provenance and never become evidence.

ALTER TABLE public.graph_entities
  DROP CONSTRAINT IF EXISTS graph_entities_entity_type_check;

ALTER TABLE public.graph_entities
  ADD CONSTRAINT graph_entities_entity_type_check CHECK (
    entity_type IN (
      'founder',
      'person',
      'repository',
      'project',
      'hackathon',
      'organization',
      'company',
      'accelerator',
      'accelerator_cohort',
      'legal_entity',
      'registration',
      'website',
      'social_account',
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
      'source_external_id',
      'personal_website_url',
      'company_website_url',
      'company_domain',
      'linkedin_url',
      'reddit_url',
      'accelerator_company_url',
      'accelerator_cohort_url',
      'euid',
      'german_register_key'
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
      'RECEIVED_PRIZE_AT',
      'FOUNDED',
      'OPERATED_BY',
      'ACCELERATED_BY',
      'HAS_WEBSITE',
      'HAS_SOCIAL_IDENTIFIER',
      'MANAGING_DIRECTOR_OF',
      'SHAREHOLDER_OF',
      'REGISTERED_REPRESENTATIVE_OF'
    )
  );

ALTER TABLE public.discovery_runs
  DROP CONSTRAINT IF EXISTS discovery_runs_source_check,
  DROP CONSTRAINT IF EXISTS discovery_runs_status_check;

ALTER TABLE public.discovery_runs
  ADD CONSTRAINT discovery_runs_source_check CHECK (
    source IN ('github', 'hackathon', 'accelerator', 'german_register', 'multi')
  ),
  ADD CONSTRAINT discovery_runs_status_check CHECK (
    status IN (
      'planned',
      'running',
      'completed',
      'partial',
      'failed',
      'disabled_unconfigured'
    )
  ),
  ADD COLUMN IF NOT EXISTS source_results_json jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.discovery_candidates
  DROP CONSTRAINT IF EXISTS discovery_candidates_source_check;

ALTER TABLE public.discovery_candidates
  ADD CONSTRAINT discovery_candidates_source_check CHECK (
    source IN ('github', 'hackathon', 'accelerator', 'german_register')
  );

CREATE TABLE IF NOT EXISTS public.graph_entity_resolution_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  left_entity_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  right_entity_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'possible' CHECK (status IN ('possible', 'rejected', 'merged')),
  reason text NOT NULL,
  identifiers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT graph_entity_resolution_distinct CHECK (left_entity_id <> right_entity_id),
  CONSTRAINT graph_entity_resolution_pair_unique UNIQUE (left_entity_id, right_entity_id)
);

ALTER TABLE public.graph_entity_resolution_candidates
  DROP CONSTRAINT IF EXISTS graph_entity_resolution_candidates_status_check,
  DROP CONSTRAINT IF EXISTS graph_entity_resolution_distinct;

ALTER TABLE public.graph_entity_resolution_candidates
  ADD CONSTRAINT graph_entity_resolution_candidates_status_check CHECK (
    status IN ('possible', 'rejected', 'merged')
  ),
  ADD CONSTRAINT graph_entity_resolution_distinct CHECK (left_entity_id <> right_entity_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.graph_entity_resolution_candidates'::regclass
      AND tgname IN (
        'graph_entity_resolution_candidates_updated_at',
        'update_graph_entity_resolution_candidates_updated_at'
      )
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_graph_entity_resolution_candidates_updated_at
      BEFORE UPDATE ON public.graph_entity_resolution_candidates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

GRANT ALL ON public.graph_entity_resolution_candidates TO service_role;
ALTER TABLE public.graph_entity_resolution_candidates ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.discovery_runs.source_results_json IS
  'Per-source planned/running/completed/partial/failed/disabled status and bounded scan counts.';
COMMENT ON TABLE public.graph_entity_resolution_candidates IS
  'Ambiguous cross-source identity suggestions requiring review; names alone never merge entities.';
