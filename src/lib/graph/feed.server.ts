import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { GraphFounderCard } from "./types";

/**
 * Graph feed loader.
 *
 * The graph_* schema (graph_entities, graph_relationships, graph_claims,
 * graph_evidence, and the `graph_entity_id` FK on `founder_profiles`) is not
 * yet provisioned in this project. Until the schema lands, return an empty
 * feed so consumers fall back to the demo founder deck instead of throwing.
 */
export async function loadPublishedGraphFounderCards(
  _injectedClient?: SupabaseClient<Database>,
): Promise<GraphFounderCard[]> {
  return [];
}
