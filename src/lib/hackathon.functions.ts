import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { GraphEntityInput, GraphIdentifierScheme } from "./graph/types";

const HackathonInput = z
  .object({
    profileId: z.string().uuid(),
    projectUrl: z.string().trim().min(1, "Add a public project or submission URL."),
    eventUrl: z.string().trim().optional().default(""),
    eventName: z.string().trim().max(160).optional().default(""),
    projectName: z.string().trim().max(160).optional().default(""),
    claimedRole: z.string().trim().max(240).optional().default(""),
    claimedResult: z
      .enum(["participant", "finalist", "winner", "prize", "unknown"])
      .default("unknown"),
  })
  .strict();

const IDENTIFIER_SCHEMES = new Set<GraphIdentifierScheme>([
  "github_user_id",
  "github_login",
  "github_repo_id",
  "github_repo_full_name",
  "matchfund_profile_id",
  "canonical_url",
  "project_url",
  "hackathon_url",
  "organization_url",
  "source_external_id",
]);

export const ingestHackathonEvidence = createServerFn({ method: "POST" })
  .validator((data: unknown) => HackathonInput.parse(data))
  .handler(async ({ data }) => {
    const [{ supabaseAdmin }, { HackathonEvidenceAdapter }, { persistGraphIngestion }] =
      await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("./graph/hackathon-evidence.server"),
        import("./graph/persistence.server"),
      ]);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("founder_profiles")
      .select("id,graph_entity_id,name,github,linkedin,site,published")
      .eq("id", data.profileId)
      .single();
    if (profileError) throw new Error(`Founder profile lookup failed: ${profileError.message}`);
    if (!profile.graph_entity_id) {
      throw new Error("Import GitHub evidence before adding hackathon evidence.");
    }

    const [
      { data: founder, error: founderError },
      { data: identifierRows, error: identifierError },
    ] = await Promise.all([
      supabaseAdmin
        .from("graph_entities")
        .select("id,entity_type,canonical_key,canonical_name,properties")
        .eq("id", profile.graph_entity_id)
        .single(),
      supabaseAdmin
        .from("graph_entity_identifiers")
        .select("scheme,value")
        .eq("entity_id", profile.graph_entity_id),
    ]);
    if (founderError) throw new Error(`Founder graph lookup failed: ${founderError.message}`);
    if (identifierError) {
      throw new Error(`Founder identifier lookup failed: ${identifierError.message}`);
    }
    if (founder.entity_type !== "founder") {
      throw new Error("The profile is not linked to a founder graph entity.");
    }

    const founderAnchor: GraphEntityInput = {
      tempId: `founder:${founder.id}`,
      entityType: "founder",
      canonicalKey: founder.canonical_key,
      canonicalName: founder.canonical_name || profile.name,
      properties: founder.properties,
      identifiers: (identifierRows ?? []).flatMap((identifier) =>
        IDENTIFIER_SCHEMES.has(identifier.scheme as GraphIdentifierScheme)
          ? [
              {
                scheme: identifier.scheme as GraphIdentifierScheme,
                value: identifier.value,
              },
            ]
          : [],
      ),
    };

    const adapter = new HackathonEvidenceAdapter();
    const graph = await adapter.ingest({
      projectUrl: data.projectUrl,
      eventUrl: data.eventUrl || undefined,
      eventName: data.eventName || undefined,
      projectName: data.projectName || undefined,
      claimedRole: data.claimedRole || undefined,
      claimedResult: data.claimedResult,
      founder: founderAnchor,
    });
    const persisted = await persistGraphIngestion(graph, profile.id);

    return {
      profileId: profile.id,
      graphEntityId: persisted.founderEntityId,
      alreadyPublished: profile.published,
      ingestion: persisted.summary,
      extraction: graph.extraction,
      verification: graph.verification,
      founderScore: "Insufficient evidence" as const,
    };
  });
