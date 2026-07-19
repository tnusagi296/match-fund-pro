CREATE OR REPLACE FUNCTION public.graph_entity_is_published(_entity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.founder_profiles fp
    WHERE fp.published = true AND fp.graph_entity_id = _entity_id
  ) OR EXISTS (
    SELECT 1
    FROM public.founder_profiles fp
    JOIN public.graph_relationships r1 ON r1.source_entity_id = fp.graph_entity_id
    WHERE fp.published = true
      AND (r1.target_entity_id = _entity_id OR r1.source_entity_id = _entity_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.founder_profiles fp
    JOIN public.graph_relationships r1 ON r1.source_entity_id = fp.graph_entity_id
    JOIN public.graph_relationships r2 ON r2.source_entity_id = r1.target_entity_id
    WHERE fp.published = true
      AND (r2.target_entity_id = _entity_id OR r2.source_entity_id = _entity_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.graph_entity_is_published(uuid) TO anon, authenticated, service_role;