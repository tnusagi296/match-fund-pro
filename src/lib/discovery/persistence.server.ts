import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type {
  DiscoveryCandidateUpdate,
  DiscoveryCandidate,
  DiscoveryPlan,
  DiscoveryRunStats,
  DiscoveryRunUpdate,
  PersistedDiscoveryCandidate,
} from "./types";
import { discoveryReasonsJson } from "./types";

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export interface DiscoveryPersistenceStore {
  createRun(plan: DiscoveryPlan, startedAt: string): Promise<string>;
  upsertCandidate(
    runId: string,
    candidate: DiscoveryCandidate,
  ): Promise<PersistedDiscoveryCandidate>;
  updateCandidate(candidateId: string, update: DiscoveryCandidateUpdate): Promise<void>;
  completeRun(runId: string, update: DiscoveryRunUpdate): Promise<void>;
}

export class SupabaseDiscoveryStore implements DiscoveryPersistenceStore {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createRun(plan: DiscoveryPlan, startedAt: string): Promise<string> {
    const queries = plan.sources.flatMap((source) =>
      source.queries.map((query) => ({ source: source.source, ...query })),
    );
    const { data, error } = await this.client
      .from("discovery_runs")
      .insert({
        thesis_id: plan.thesisId,
        source: "multi",
        status: "running",
        plan_json: asJson(plan),
        queries_json: asJson(queries),
        stats_json: {},
        started_at: startedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Discovery run creation failed: ${error.message}`);
    return data.id;
  }

  async upsertCandidate(
    runId: string,
    candidate: DiscoveryCandidate,
  ): Promise<PersistedDiscoveryCandidate> {
    const { data, error } = await this.client
      .from("discovery_candidates")
      .upsert(
        {
          discovery_run_id: runId,
          source: candidate.source,
          source_identifier: candidate.sourceIdentifier,
          source_url: candidate.sourceUrl,
          discovery_reasons_json: discoveryReasonsJson(candidate.discoveryReasons),
          status: "discovered",
          error_summary: null,
        },
        { onConflict: "discovery_run_id,source,source_identifier" },
      )
      .select("id,status")
      .single();
    if (error) throw new Error(`Discovery candidate upsert failed: ${error.message}`);
    return { id: data.id, status: data.status as PersistedDiscoveryCandidate["status"] };
  }

  async updateCandidate(candidateId: string, update: DiscoveryCandidateUpdate): Promise<void> {
    const { error } = await this.client
      .from("discovery_candidates")
      .update({
        status: update.status,
        founder_graph_entity_id: update.founderGraphEntityId,
        founder_profile_id: update.founderProfileId,
        error_summary: update.errorSummary,
      })
      .eq("id", candidateId);
    if (error) throw new Error(`Discovery candidate update failed: ${error.message}`);
  }

  async completeRun(runId: string, update: DiscoveryRunUpdate): Promise<void> {
    const errorSummary = update.issues.map((issue) => issue.message).join(" · ") || null;
    const { error } = await this.client
      .from("discovery_runs")
      .update({
        status: update.status,
        stats_json: asJson(update.stats),
        source_results_json: asJson(update.sourceResults ?? []),
        error_summary: errorSummary,
        completed_at: update.completedAt,
      })
      .eq("id", runId);
    if (error) throw new Error(`Discovery run completion failed: ${error.message}`);
  }
}

export async function createSupabaseDiscoveryStore(): Promise<SupabaseDiscoveryStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return new SupabaseDiscoveryStore(supabaseAdmin);
}

export function emptyDiscoveryStats(queriesPlanned: number): DiscoveryRunStats {
  return {
    queriesPlanned,
    queriesExecuted: 0,
    repositoriesEvaluated: 0,
    recordsEvaluated: 0,
    candidateFoundersDiscovered: 0,
    candidatesEnriched: 0,
    profilesIngested: 0,
    skipped: 0,
    failed: 0,
    entitiesCreated: 0,
    evidenceCreated: 0,
    relationshipsCreated: 0,
    claimsCreated: 0,
  };
}
