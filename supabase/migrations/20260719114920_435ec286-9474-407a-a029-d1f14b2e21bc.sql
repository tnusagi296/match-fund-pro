
-- profile_visibility_state (private / discoverable / published)
CREATE TYPE public.profile_visibility_state AS ENUM ('private', 'discoverable', 'published');

ALTER TABLE public.founder_profiles
  ADD COLUMN IF NOT EXISTS visibility_state public.profile_visibility_state NOT NULL DEFAULT 'private';

-- Backfill: published rows -> 'published', anything else stays 'private'
UPDATE public.founder_profiles SET visibility_state = 'published' WHERE published = true;

-- discovery_runs
CREATE TABLE public.discovery_runs (
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

CREATE TRIGGER discovery_runs_updated_at
  BEFORE UPDATE ON public.discovery_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- discovery_candidates
CREATE TABLE public.discovery_candidates (
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

CREATE INDEX discovery_candidates_founder_profile_idx
  ON public.discovery_candidates(founder_profile_id) WHERE founder_profile_id IS NOT NULL;

GRANT ALL ON public.discovery_candidates TO service_role;
ALTER TABLE public.discovery_candidates ENABLE ROW LEVEL SECURITY;
-- No policies: service_role only. Feed queries use supabaseAdmin.

CREATE TRIGGER discovery_candidates_updated_at
  BEFORE UPDATE ON public.discovery_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
