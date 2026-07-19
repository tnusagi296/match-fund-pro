
-- Grant read access to anon/authenticated so policies can take effect
GRANT SELECT ON public.graph_entities TO anon, authenticated;
GRANT SELECT ON public.graph_entity_identifiers TO anon, authenticated;
GRANT SELECT ON public.graph_relationships TO anon, authenticated;
GRANT SELECT ON public.graph_relationship_evidence TO anon, authenticated;
GRANT SELECT ON public.graph_claims TO anon, authenticated;
GRANT SELECT ON public.graph_claim_evidence TO anon, authenticated;
GRANT SELECT ON public.graph_evidence TO anon, authenticated;

-- Helper: entity is reachable from a published founder profile if it is
-- the founder entity itself, a direct neighbor, or a second-hop neighbor.
CREATE OR REPLACE FUNCTION public.graph_entity_is_published(_entity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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

CREATE POLICY "Published graph entities are viewable"
  ON public.graph_entities FOR SELECT
  TO anon, authenticated
  USING (public.graph_entity_is_published(id));

CREATE POLICY "Identifiers of published graph entities are viewable"
  ON public.graph_entity_identifiers FOR SELECT
  TO anon, authenticated
  USING (public.graph_entity_is_published(entity_id));

CREATE POLICY "Published graph relationships are viewable"
  ON public.graph_relationships FOR SELECT
  TO anon, authenticated
  USING (
    public.graph_entity_is_published(source_entity_id)
    OR public.graph_entity_is_published(target_entity_id)
  );

CREATE POLICY "Published graph claims are viewable"
  ON public.graph_claims FOR SELECT
  TO anon, authenticated
  USING (public.graph_entity_is_published(subject_entity_id));

CREATE POLICY "Evidence linked to published relationships is viewable"
  ON public.graph_relationship_evidence FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.graph_relationships r
      WHERE r.id = relationship_id
        AND (
          public.graph_entity_is_published(r.source_entity_id)
          OR public.graph_entity_is_published(r.target_entity_id)
        )
    )
  );

CREATE POLICY "Evidence linked to published claims is viewable"
  ON public.graph_claim_evidence FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.graph_claims c
      WHERE c.id = claim_id
        AND public.graph_entity_is_published(c.subject_entity_id)
    )
  );

CREATE POLICY "Evidence referenced by published graph is viewable"
  ON public.graph_evidence FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.graph_relationship_evidence re
      JOIN public.graph_relationships r ON r.id = re.relationship_id
      WHERE re.evidence_id = graph_evidence.id
        AND (
          public.graph_entity_is_published(r.source_entity_id)
          OR public.graph_entity_is_published(r.target_entity_id)
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.graph_claim_evidence ce
      JOIN public.graph_claims c ON c.id = ce.claim_id
      WHERE ce.evidence_id = graph_evidence.id
        AND public.graph_entity_is_published(c.subject_entity_id)
    )
  );
