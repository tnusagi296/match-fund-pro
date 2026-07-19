
-- profile_visibility_state (private / discoverable / published)
CREATE TYPE public.profile_visibility_state AS ENUM ('private', 'discoverable', 'published');

ALTER TABLE public.founder_profiles
  ADD COLUMN IF NOT EXISTS visibility_state public.profile_visibility_state NOT NULL DEFAULT 'private';

ALTER TABLE public.founder_profiles
  DROP CONSTRAINT IF EXISTS founder_profiles_visibility_state_check;

-- Older graph migrations represented this lifecycle field as constrained text.
-- Reconcile an existing database with the enum-backed Lovable schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'founder_profiles'
      AND column_name = 'visibility_state'
      AND udt_name <> 'profile_visibility_state'
  ) THEN
    ALTER TABLE public.founder_profiles ALTER COLUMN visibility_state DROP DEFAULT;
    ALTER TABLE public.founder_profiles
      ALTER COLUMN visibility_state TYPE public.profile_visibility_state
      USING visibility_state::text::public.profile_visibility_state;
    ALTER TABLE public.founder_profiles
      ALTER COLUMN visibility_state SET DEFAULT 'private'::public.profile_visibility_state;
  END IF;
END;
$$;

ALTER TABLE public.founder_profiles
  ADD CONSTRAINT founder_profiles_visibility_state_check CHECK (
    visibility_state::text IN ('private', 'discoverable', 'published')
  );

-- Backfill: published rows -> 'published', anything else stays 'private'
UPDATE public.founder_profiles SET visibility_state = 'published' WHERE published = true;

-- discovery_runs
CREATE TABLE IF NOT EXISTS public.discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id text,
  source text NOT NULL,
  status text NOT NULL,
  plan_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  queries_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_results_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.discovery_runs TO service_role;
ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.discovery_runs'::regclass
      AND tgname IN ('discovery_runs_updated_at', 'update_discovery_runs_updated_at')
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER discovery_runs_updated_at
      BEFORE UPDATE ON public.discovery_runs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- discovery_candidates
CREATE TABLE IF NOT EXISTS public.discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_run_id uuid NOT NULL REFERENCES public.discovery_runs(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_identifier text NOT NULL,
  source_url text NOT NULL,
  discovery_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'discovered',
  founder_graph_entity_id uuid REFERENCES public.graph_entities(id) ON DELETE SET NULL,
  founder_profile_id uuid REFERENCES public.founder_profiles(id) ON DELETE SET NULL,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (discovery_run_id, source, source_identifier)
);

CREATE INDEX IF NOT EXISTS discovery_candidates_founder_profile_idx
  ON public.discovery_candidates(founder_profile_id) WHERE founder_profile_id IS NOT NULL;

ALTER TABLE public.discovery_runs
  ADD COLUMN IF NOT EXISTS source_results_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ALTER COLUMN thesis_id DROP NOT NULL;

UPDATE public.discovery_runs SET started_at = created_at WHERE started_at IS NULL;
ALTER TABLE public.discovery_runs
  ALTER COLUMN started_at SET DEFAULT now(),
  ALTER COLUMN started_at SET NOT NULL;

GRANT ALL ON public.discovery_candidates TO service_role;
ALTER TABLE public.discovery_candidates ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only. Feed queries use supabaseAdmin.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.discovery_candidates'::regclass
      AND tgname IN ('discovery_candidates_updated_at', 'update_discovery_candidates_updated_at')
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER discovery_candidates_updated_at
      BEFORE UPDATE ON public.discovery_candidates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;
