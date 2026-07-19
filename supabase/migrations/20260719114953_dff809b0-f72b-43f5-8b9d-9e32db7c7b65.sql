
-- Align existing profile_source_origin with legacy code values
ALTER TYPE public.profile_source_origin ADD VALUE IF NOT EXISTS 'public_scan';
ALTER TYPE public.profile_source_origin ADD VALUE IF NOT EXISTS 'founder_submission';
ALTER TYPE public.profile_source_origin ADD VALUE IF NOT EXISTS 'demo';

-- Align claim status with legacy code values
ALTER TYPE public.profile_claim_status ADD VALUE IF NOT EXISTS 'self_submitted';

-- graph_entity_resolution_candidates: pairs of possibly-duplicate entities
CREATE TABLE IF NOT EXISTS public.graph_entity_resolution_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  left_entity_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  right_entity_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'possible',
  reason text NOT NULL,
  identifiers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (left_entity_id, right_entity_id)
);

GRANT ALL ON public.graph_entity_resolution_candidates TO service_role;
ALTER TABLE public.graph_entity_resolution_candidates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'graph_entity_resolution_candidates'
      AND policyname = 'service role only'
  ) THEN
    CREATE POLICY "service role only" ON public.graph_entity_resolution_candidates
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END;
$$;

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
    CREATE TRIGGER graph_entity_resolution_candidates_updated_at
      BEFORE UPDATE ON public.graph_entity_resolution_candidates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- Add policies for the two prior internal tables to satisfy linter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'discovery_runs'
      AND policyname = 'service role only'
  ) THEN
    CREATE POLICY "service role only" ON public.discovery_runs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'discovery_candidates'
      AND policyname = 'service role only'
  ) THEN
    CREATE POLICY "service role only" ON public.discovery_candidates
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END;
$$;
