
-- Align existing profile_source_origin with legacy code values
ALTER TYPE public.profile_source_origin ADD VALUE IF NOT EXISTS 'public_scan';
ALTER TYPE public.profile_source_origin ADD VALUE IF NOT EXISTS 'founder_submission';
ALTER TYPE public.profile_source_origin ADD VALUE IF NOT EXISTS 'demo';

-- Align claim status with legacy code values
ALTER TYPE public.profile_claim_status ADD VALUE IF NOT EXISTS 'self_submitted';

-- graph_entity_resolution_candidates: pairs of possibly-duplicate entities
CREATE TABLE public.graph_entity_resolution_candidates (
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
CREATE POLICY "service role only" ON public.graph_entity_resolution_candidates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER graph_entity_resolution_candidates_updated_at
  BEFORE UPDATE ON public.graph_entity_resolution_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add policies for the two prior internal tables to satisfy linter
CREATE POLICY "service role only" ON public.discovery_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role only" ON public.discovery_candidates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
