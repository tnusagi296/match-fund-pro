-- Compatibility no-op.
--
-- Lovable originally generated this migration as a second CREATE TABLE copy
-- of the graph schema that already exists in
-- 20260719090000_matchfund_evidence_graph.sql. Replaying the repository from
-- scratch therefore failed with "relation already exists" before later graph
-- and RLS migrations could run.
--
-- Keep this migration version in place because connected Supabase projects may
-- already have recorded it. The additive hackathon fields and constraints are
-- applied by 20260719110000_hackathon_evidence_graph.sql.

SELECT 1;
