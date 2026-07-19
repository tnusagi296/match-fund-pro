-- MatchFund bounded, thesis-driven public founder discovery.
-- Discovery runs are server-managed. Search reasons are provenance for why a
-- candidate was evaluated; they are deliberately not graph evidence.

ALTER TABLE public.founder_profiles
  ADD COLUMN IF NOT EXISTS profile_origin text NOT NULL DEFAULT 'founder_submission',
  ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'self_submitted',
  ADD COLUMN IF NOT EXISTS visibility_state text NOT NULL DEFAULT 'private';

ALTER TABLE public.founder_profiles
  ALTER COLUMN profile_origin SET DEFAULT 'founder_submission',
  ALTER COLUMN claim_status SET DEFAULT 'self_submitted',
  ALTER COLUMN visibility_state SET DEFAULT 'private';

ALTER TABLE public.founder_profiles
  DROP CONSTRAINT IF EXISTS founder_profiles_profile_origin_check,
  DROP CONSTRAINT IF EXISTS founder_profiles_claim_status_check,
  DROP CONSTRAINT IF EXISTS founder_profiles_visibility_state_check;

ALTER TABLE public.founder_profiles
  ADD CONSTRAINT founder_profiles_profile_origin_check CHECK (
    profile_origin::text IN (
      'crawler',
      'self_created',
      'public_scan',
      'founder_submission',
      'demo'
    )
  ),
  ADD CONSTRAINT founder_profiles_claim_status_check CHECK (
    claim_status::text IN (
      'unclaimed',
      'pending',
      'self_submitted',
      'claimed',
      'rejected'
    )
  ),
  ADD CONSTRAINT founder_profiles_visibility_state_check CHECK (
    visibility_state::text IN ('private', 'discoverable', 'published')
  );

UPDATE public.founder_profiles
SET visibility_state = 'published'
WHERE published = true;

CREATE TABLE IF NOT EXISTS public.discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('github')),
  status text NOT NULL CHECK (
    status IN ('planned', 'running', 'completed', 'partial', 'failed')
  ),
  plan_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  queries_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_run_id uuid NOT NULL REFERENCES public.discovery_runs(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('github')),
  source_identifier text NOT NULL,
  source_url text NOT NULL,
  founder_graph_entity_id uuid REFERENCES public.graph_entities(id) ON DELETE SET NULL,
  founder_profile_id uuid REFERENCES public.founder_profiles(id) ON DELETE SET NULL,
  discovery_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (
    status IN ('discovered', 'ingested', 'skipped', 'failed')
  ),
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_candidates_run_source_identifier_unique UNIQUE (
    discovery_run_id,
    source,
    source_identifier
  )
);

ALTER TABLE public.discovery_runs
  DROP CONSTRAINT IF EXISTS discovery_runs_source_check,
  DROP CONSTRAINT IF EXISTS discovery_runs_status_check;

ALTER TABLE public.discovery_runs
  ADD CONSTRAINT discovery_runs_source_check CHECK (source IN ('github')),
  ADD CONSTRAINT discovery_runs_status_check CHECK (
    status IN ('planned', 'running', 'completed', 'partial', 'failed')
  );

ALTER TABLE public.discovery_candidates
  DROP CONSTRAINT IF EXISTS discovery_candidates_source_check,
  DROP CONSTRAINT IF EXISTS discovery_candidates_status_check;

ALTER TABLE public.discovery_candidates
  ADD CONSTRAINT discovery_candidates_source_check CHECK (source IN ('github')),
  ADD CONSTRAINT discovery_candidates_status_check CHECK (
    status IN ('discovered', 'ingested', 'skipped', 'failed')
  );

CREATE INDEX IF NOT EXISTS discovery_runs_thesis_created_at_idx
  ON public.discovery_runs(thesis_id, created_at DESC);
CREATE INDEX IF NOT EXISTS discovery_candidates_source_identifier_idx
  ON public.discovery_candidates(source, source_identifier);
CREATE INDEX IF NOT EXISTS discovery_candidates_graph_entity_idx
  ON public.discovery_candidates(founder_graph_entity_id)
  WHERE founder_graph_entity_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.discovery_runs'::regclass
      AND tgname IN ('discovery_runs_updated_at', 'update_discovery_runs_updated_at')
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_discovery_runs_updated_at
      BEFORE UPDATE ON public.discovery_runs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.discovery_candidates'::regclass
      AND tgname IN ('discovery_candidates_updated_at', 'update_discovery_candidates_updated_at')
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_discovery_candidates_updated_at
      BEFORE UPDATE ON public.discovery_candidates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

GRANT ALL ON public.discovery_runs TO service_role;
GRANT ALL ON public.discovery_candidates TO service_role;

ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_candidates ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.discovery_runs IS
  'Bounded public-source scans generated deterministically from a saved investor thesis snapshot.';
COMMENT ON TABLE public.discovery_candidates IS
  'Candidate provenance and processing state. Discovery reasons are not evidence of founder claims.';
COMMENT ON COLUMN public.discovery_candidates.discovery_reasons_json IS
  'Why a public source result was selected for evaluation; never used directly as graph evidence.';
COMMENT ON COLUMN public.founder_profiles.profile_origin IS
  'How the canonical profile was first created: public scan, founder submission, or demo.';
COMMENT ON COLUMN public.founder_profiles.claim_status IS
  'Whether the profile is unclaimed, self-submitted, or identity-claimed.';
COMMENT ON COLUMN public.founder_profiles.visibility_state IS
  'Private founder submissions, discoverable public scans, or founder-published profiles.';
