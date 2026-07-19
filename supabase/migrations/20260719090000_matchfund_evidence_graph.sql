-- MatchFund's first relational evidence graph.
-- Graph writes and reads are performed by server functions using service_role;
-- the browser only receives purpose-built founder-card projections.

CREATE TABLE public.graph_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (
    entity_type IN ('founder', 'repository', 'project', 'skill', 'sector', 'source')
  ),
  canonical_key text NOT NULL,
  canonical_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT graph_entities_type_key_unique UNIQUE (entity_type, canonical_key)
);

CREATE TABLE public.graph_entity_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  scheme text NOT NULL CHECK (
    scheme IN (
      'github_user_id',
      'github_login',
      'github_repo_id',
      'github_repo_full_name',
      'matchfund_profile_id'
    )
  ),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT graph_entity_identifiers_scheme_value_unique UNIQUE (scheme, value)
);

CREATE TABLE public.graph_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_url text NOT NULL,
  source_external_id text,
  retrieved_at timestamptz NOT NULL,
  excerpt text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL UNIQUE,
  reliability numeric(4, 3) NOT NULL CHECK (reliability >= 0 AND reliability <= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.graph_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (
    relationship_type IN (
      'HAS_PROFILE',
      'OWNS_REPOSITORY',
      'BUILT',
      'USES_LANGUAGE',
      'FOCUSES_ON',
      'SUPPORTED_BY'
    )
  ),
  confidence numeric(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  observed_at timestamptz NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT graph_relationships_edge_unique UNIQUE (
    source_entity_id,
    target_entity_id,
    relationship_type
  )
);

CREATE TABLE public.graph_relationship_evidence (
  relationship_id uuid NOT NULL REFERENCES public.graph_relationships(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.graph_evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (relationship_id, evidence_id)
);

CREATE TABLE public.graph_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_entity_id uuid NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  predicate text NOT NULL,
  value jsonb NOT NULL,
  status text NOT NULL CHECK (
    status IN ('supported', 'self_reported', 'unknown', 'contradicted')
  ),
  trust_level text NOT NULL CHECK (trust_level IN ('high', 'medium', 'low', 'unknown')),
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT graph_claims_subject_predicate_value_unique UNIQUE (
    subject_entity_id,
    predicate,
    value
  )
);

CREATE TABLE public.graph_claim_evidence (
  claim_id uuid NOT NULL REFERENCES public.graph_claims(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.graph_evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (claim_id, evidence_id)
);

ALTER TABLE public.founder_profiles
  ADD COLUMN graph_entity_id uuid REFERENCES public.graph_entities(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX founder_profiles_graph_entity_id_unique
  ON public.founder_profiles(graph_entity_id)
  WHERE graph_entity_id IS NOT NULL;

CREATE INDEX graph_entity_identifiers_entity_id_idx
  ON public.graph_entity_identifiers(entity_id);
CREATE INDEX graph_relationships_source_entity_id_idx
  ON public.graph_relationships(source_entity_id);
CREATE INDEX graph_relationships_target_entity_id_idx
  ON public.graph_relationships(target_entity_id);
CREATE INDEX graph_claims_subject_entity_id_idx
  ON public.graph_claims(subject_entity_id);
CREATE INDEX graph_evidence_source_external_id_idx
  ON public.graph_evidence(source_type, source_external_id);

CREATE TRIGGER update_graph_entities_updated_at
  BEFORE UPDATE ON public.graph_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.graph_entities TO service_role;
GRANT ALL ON public.graph_entity_identifiers TO service_role;
GRANT ALL ON public.graph_evidence TO service_role;
GRANT ALL ON public.graph_relationships TO service_role;
GRANT ALL ON public.graph_relationship_evidence TO service_role;
GRANT ALL ON public.graph_claims TO service_role;
GRANT ALL ON public.graph_claim_evidence TO service_role;

ALTER TABLE public.graph_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_entity_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_relationship_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_claim_evidence ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.graph_entities IS
  'Canonical founder-intelligence entities stored as a relational graph.';
COMMENT ON TABLE public.graph_evidence IS
  'Source snapshots supporting graph relationships and claims.';
COMMENT ON COLUMN public.graph_evidence.raw_payload IS
  'Selected source fields required for MatchFund evidence, never a full API archive.';
COMMENT ON COLUMN public.founder_profiles.graph_entity_id IS
  'Links the publication/profile record to its canonical founder graph entity.';
