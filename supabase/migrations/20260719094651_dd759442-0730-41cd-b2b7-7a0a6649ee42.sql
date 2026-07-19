REVOKE EXECUTE ON FUNCTION public.graph_entity_is_published(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.graph_entity_is_published(uuid) TO service_role;