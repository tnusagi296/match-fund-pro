import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { GraphIngestionResult } from "./graph/types";

export type FounderSignal = {
  source: "github" | "arxiv" | "semantic_scholar" | "deck" | "profile";
  kind: string;
  title: string;
  detail?: string;
  weight: number;
  evidence_url?: string;
};

const CrawlInput = z.object({
  name: z.string().trim().min(1, "Add your name before starting the crawl."),
  headline: z.string().default(""),
  github: z
    .string()
    .trim()
    .min(1, "A GitHub username or full GitHub profile URL is required for graph ingestion."),
  linkedin: z.string().optional().default(""),
  site: z.string().optional().default(""),
  deckText: z.string().optional().default(""),
});

function graphSignals(result: GraphIngestionResult): FounderSignal[] {
  const repositories = result.entities.filter((entity) => entity.entityType === "repository");
  const languages = result.entities
    .filter(
      (entity) =>
        entity.entityType === "skill" &&
        entity.properties &&
        typeof entity.properties === "object" &&
        !Array.isArray(entity.properties) &&
        entity.properties.category === "programming_language",
    )
    .map((entity) => entity.canonicalName);
  const topics = result.entities
    .filter((entity) => entity.entityType === "sector")
    .map((entity) => entity.canonicalName);
  const profileEvidence = result.evidence.find((item) => item.sourceType === "github_user");
  const latestRepositoryEvidence = result.evidence
    .filter((item) => item.sourceType === "github_repository")
    .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))[0];

  const signals: FounderSignal[] = [
    {
      source: "github",
      kind: "profile",
      title: "Live GitHub profile verified",
      detail: profileEvidence?.excerpt,
      weight: 1,
      evidence_url: profileEvidence?.sourceUrl,
    },
    {
      source: "github",
      kind: "repositories",
      title: `${repositories.length} public ${repositories.length === 1 ? "repository" : "repositories"} ingested`,
      detail: "Repository ownership is supported by GitHub owner IDs; authorship is not inferred.",
      weight: 1,
      evidence_url: latestRepositoryEvidence?.sourceUrl ?? profileEvidence?.sourceUrl,
    },
  ];

  if (languages.length > 0) {
    signals.push({
      source: "github",
      kind: "languages",
      title: `Languages: ${languages.slice(0, 5).join(", ")}`,
      detail: "GitHub primary-language metadata",
      weight: 1,
      evidence_url: latestRepositoryEvidence?.sourceUrl,
    });
  }
  if (topics.length > 0) {
    signals.push({
      source: "github",
      kind: "topics",
      title: `Topics: ${topics.slice(0, 5).join(", ")}`,
      detail: "Founder-controlled GitHub repository metadata",
      weight: 1,
      evidence_url: latestRepositoryEvidence?.sourceUrl,
    });
  }
  return signals;
}

async function crawlSemanticScholar(name: string): Promise<FounderSignal[]> {
  try {
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(name)}&limit=1&fields=name,paperCount,citationCount,hIndex,url`,
    );
    if (!response.ok) return [];
    const json = (await response.json()) as {
      data?: Array<{
        name: string;
        paperCount?: number;
        citationCount?: number;
        hIndex?: number;
        url?: string;
      }>;
    };
    const author = json.data?.[0];
    if (!author || (author.paperCount ?? 0) === 0) return [];
    return [
      {
        source: "semantic_scholar",
        kind: "publications",
        title: `${author.paperCount} publications`,
        detail: `${author.citationCount ?? 0} citations · h-index ${author.hIndex ?? 0}`,
        weight: 1,
        evidence_url: author.url,
      },
    ];
  } catch (error) {
    console.error("Semantic Scholar crawl failed", error);
    return [];
  }
}

async function crawlArxiv(name: string): Promise<FounderSignal[]> {
  try {
    const response = await fetch(
      `https://export.arxiv.org/api/query?search_query=au:%22${encodeURIComponent(name)}%22&max_results=5`,
    );
    if (!response.ok) return [];
    const xml = await response.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    if (entries.length === 0) return [];
    return [
      {
        source: "arxiv",
        kind: "preprints",
        title: `${entries.length} arXiv preprint${entries.length === 1 ? "" : "s"}`,
        detail: entries
          .slice(0, 2)
          .map((entry) =>
            entry
              .match(/<title>([\s\S]*?)<\/title>/)?.[1]
              ?.trim()
              .replace(/\s+/g, " "),
          )
          .filter(Boolean)
          .join(" · "),
        weight: 1,
        evidence_url: `https://arxiv.org/search/?query=${encodeURIComponent(name)}&searchtype=author`,
      },
    ];
  } catch (error) {
    console.error("arXiv crawl failed", error);
    return [];
  }
}

export const crawlFounderGraph = createServerFn({ method: "POST" })
  .validator((data: unknown) => CrawlInput.parse(data))
  .handler(async ({ data }) => {
    const [{ GitHubGraphAdapter }, persistence, semanticScholarSignals, arxivSignals] =
      await Promise.all([
        import("./graph/github-graph.server"),
        import("./graph/persistence.server"),
        crawlSemanticScholar(data.name),
        crawlArxiv(data.name),
      ]);

    const adapter = new GitHubGraphAdapter({ token: process.env.GITHUB_TOKEN });
    const graph = await adapter.ingest({
      github: data.github,
      founderName: data.name,
      headline: data.headline,
      linkedin: data.linkedin,
      site: data.site,
    });
    const profile = await persistence.createOrUpdateFounderProfile(graph, data);
    const persisted = await persistence.persistGraphIngestion(graph, profile.id);

    const signals: FounderSignal[] = [
      ...graphSignals(graph),
      ...semanticScholarSignals,
      ...arxivSignals,
    ];
    if (data.linkedin) {
      signals.push({
        source: "profile",
        kind: "linkedin",
        title: "LinkedIn provided by founder",
        detail: data.linkedin,
        weight: 1,
        evidence_url: data.linkedin,
      });
    }
    if (data.site) {
      signals.push({
        source: "profile",
        kind: "site",
        title: "Personal site provided by founder",
        detail: data.site,
        weight: 1,
        evidence_url: data.site,
      });
    }
    if (data.deckText.trim()) {
      signals.push({
        source: "deck",
        kind: "founder_material",
        title: "Founder-provided pitch material attached",
        detail: "Self-reported material is kept separate from GitHub-supported graph claims.",
        weight: 1,
      });
    }

    try {
      await persistence.replaceLegacyFounderSignals(profile.id, signals);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Graph ingestion succeeded, but the legacy signal projection could not be refreshed: ${detail}`,
      );
    }

    return {
      profileId: profile.id,
      graphEntityId: persisted.founderEntityId,
      signals,
      ingestion: persisted.summary,
      founderScore: "Insufficient evidence" as const,
      alreadyPublished: profile.published,
    };
  });

export const publishFounderProfile = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ profileId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("founder_profiles")
      .update({ published: true })
      .eq("id", data.profileId)
      .not("graph_entity_id", "is", null)
      .select("id,published,graph_entity_id")
      .single();
    if (error) throw new Error(`Founder publication failed: ${error.message}`);
    return {
      ok: profile.published,
      profileId: profile.id,
      graphEntityId: profile.graph_entity_id,
    };
  });
