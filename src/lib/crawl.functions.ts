import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

type Signal = {
  source: "github" | "arxiv" | "semantic_scholar" | "deck" | "profile";
  kind: string;
  title: string;
  detail?: string;
  weight: number;
  evidence_url?: string;
};

const CrawlInput = z.object({
  name: z.string().min(1),
  headline: z.string().default(""),
  github: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
  site: z.string().optional().default(""),
  deckText: z.string().optional().default(""),
});

function githubHandle(input: string): string | null {
  if (!input) return null;
  const m = input.trim().match(/(?:github\.com\/)?@?([A-Za-z0-9-]+)/);
  return m?.[1] ?? null;
}

async function crawlGitHub(handle: string): Promise<Signal[]> {
  const signals: Signal[] = [];
  const headers: Record<string, string> = { "User-Agent": "match-fund" };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const userRes = await fetch(`https://api.github.com/users/${handle}`, { headers });
    if (!userRes.ok) return signals;
    const user = (await userRes.json()) as {
      public_repos?: number;
      followers?: number;
      created_at?: string;
      bio?: string;
      html_url?: string;
    };
    signals.push({
      source: "github",
      kind: "profile",
      title: `GitHub: @${handle}`,
      detail: `${user.public_repos ?? 0} public repos · ${user.followers ?? 0} followers · joined ${user.created_at?.slice(0, 4) ?? "?"}`,
      weight: 2,
      evidence_url: user.html_url,
    });

    const reposRes = await fetch(
      `https://api.github.com/users/${handle}/repos?per_page=100&sort=pushed`,
      { headers },
    );
    if (reposRes.ok) {
      const repos = (await reposRes.json()) as Array<{
        name: string;
        stargazers_count: number;
        language: string | null;
        pushed_at: string;
        html_url: string;
        fork: boolean;
      }>;
      const owned = repos.filter((r) => !r.fork);
      const totalStars = owned.reduce((s, r) => s + r.stargazers_count, 0);
      const recent = owned.filter(
        (r) => Date.now() - new Date(r.pushed_at).getTime() < 1000 * 60 * 60 * 24 * 90,
      ).length;
      if (totalStars > 0) {
        signals.push({
          source: "github",
          kind: "stars",
          title: `${totalStars} total GitHub stars`,
          detail: `${owned.length} owned repos`,
          weight: Math.min(5, 1 + Math.floor(Math.log10(totalStars + 1) * 1.5)),
        });
      }
      if (recent > 0) {
        signals.push({
          source: "github",
          kind: "velocity",
          title: `${recent} repos updated in last 90 days`,
          detail: "High commit velocity",
          weight: Math.min(4, recent),
        });
      }
      const top = [...owned].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 3);
      for (const r of top) {
        if (r.stargazers_count < 3) continue;
        signals.push({
          source: "github",
          kind: "repo",
          title: `${r.name} (${r.stargazers_count}★)`,
          detail: r.language ?? undefined,
          weight: 1,
          evidence_url: r.html_url,
        });
      }
    }
  } catch (err) {
    console.error("github crawl failed", err);
  }
  return signals;
}

async function crawlSemanticScholar(name: string): Promise<Signal[]> {
  const signals: Signal[] = [];
  try {
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(name)}&limit=1&fields=name,paperCount,citationCount,hIndex,url`,
    );
    if (!res.ok) return signals;
    const json = (await res.json()) as {
      data?: Array<{
        name: string;
        paperCount?: number;
        citationCount?: number;
        hIndex?: number;
        url?: string;
      }>;
    };
    const author = json.data?.[0];
    if (author && (author.paperCount ?? 0) > 0) {
      signals.push({
        source: "semantic_scholar",
        kind: "publications",
        title: `${author.paperCount} publications`,
        detail: `${author.citationCount ?? 0} citations · h-index ${author.hIndex ?? 0}`,
        weight: Math.min(5, 1 + Math.floor((author.hIndex ?? 0) / 2)),
        evidence_url: author.url,
      });
    }
  } catch (err) {
    console.error("semantic scholar crawl failed", err);
  }
  return signals;
}

async function crawlArxiv(name: string): Promise<Signal[]> {
  const signals: Signal[] = [];
  try {
    const res = await fetch(
      `http://export.arxiv.org/api/query?search_query=au:%22${encodeURIComponent(name)}%22&max_results=5`,
    );
    if (!res.ok) return signals;
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    if (entries.length > 0) {
      signals.push({
        source: "arxiv",
        kind: "preprints",
        title: `${entries.length} arXiv preprint${entries.length > 1 ? "s" : ""}`,
        detail: entries
          .slice(0, 2)
          .map((e) => e.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .join(" · "),
        weight: Math.min(3, entries.length),
      });
    }
  } catch (err) {
    console.error("arxiv crawl failed", err);
  }
  return signals;
}

const ScoreSchema = z.object({
  founder_fit: z.number(),
  technical_moat: z.number(),
  traction: z.number(),
  trust: z.number(),
  overall: z.number(),
  summary: z.string(),
  highlights: z.array(z.string()),
});

async function scoreWithAI(
  input: z.infer<typeof CrawlInput>,
  signals: Signal[],
): Promise<z.infer<typeof ScoreSchema>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-3.5-flash");

  const prompt = `You are an investor-grade analyst scoring a pre-seed / hackathon-stage founder.

Founder: ${input.name}
Headline: ${input.headline}
Links: GitHub=${input.github || "none"} · LinkedIn=${input.linkedin || "none"} · Site=${input.site || "none"}

Public signals we crawled:
${signals.map((s, i) => `${i + 1}. [${s.source}/${s.kind}] ${s.title}${s.detail ? " — " + s.detail : ""}`).join("\n") || "(no signals found)"}

${input.deckText ? `Pitch deck excerpt:\n${input.deckText.slice(0, 4000)}\n` : ""}

Return JSON scores on a 0-100 scale. Be honest: no signals means low scores. Overall is a weighted average. Summary is 1-2 sentences. Highlights: 3-5 short evidence-backed bullets.`;

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: ScoreSchema }),
      prompt,
    });
    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      try {
        const parsed = JSON.parse(error.text ?? "{}");
        return ScoreSchema.parse(parsed);
      } catch {
        // fall through
      }
    }
    // Fallback deterministic
    const base = Math.min(100, signals.reduce((s, sig) => s + sig.weight * 6, 20));
    return {
      founder_fit: base,
      technical_moat: base,
      traction: Math.min(100, base - 10),
      trust: base,
      overall: base,
      summary: `Auto-generated fallback: ${signals.length} public signals found for ${input.name}.`,
      highlights: signals.slice(0, 4).map((s) => s.title),
    };
  }
}

export const crawlAndScoreFounder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CrawlInput.parse(data))
  .handler(async ({ data }) => {
    const handle = githubHandle(data.github);
    const [ghSignals, ssSignals, axSignals] = await Promise.all([
      handle ? crawlGitHub(handle) : Promise.resolve([]),
      crawlSemanticScholar(data.name),
      crawlArxiv(data.name),
    ]);

    const signals: Signal[] = [...ghSignals, ...ssSignals, ...axSignals];
    if (data.linkedin) {
      signals.push({
        source: "profile",
        kind: "linkedin",
        title: "LinkedIn provided",
        detail: data.linkedin,
        weight: 1,
        evidence_url: data.linkedin,
      });
    }
    if (data.site) {
      signals.push({
        source: "profile",
        kind: "site",
        title: "Personal site provided",
        detail: data.site,
        weight: 1,
        evidence_url: data.site,
      });
    }

    const scores = await scoreWithAI(data, signals);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("founder_profiles")
      .insert({
        name: data.name,
        headline: data.headline,
        github: data.github || null,
        linkedin: data.linkedin || null,
        site: data.site || null,
        scores,
        summary: scores.summary,
      })
      .select()
      .single();
    if (error) throw error;

    if (signals.length > 0) {
      await supabaseAdmin.from("founder_signals").insert(
        signals.map((s) => ({
          profile_id: profile.id,
          source: s.source,
          kind: s.kind,
          title: s.title,
          detail: s.detail ?? null,
          weight: s.weight,
          evidence_url: s.evidence_url ?? null,
        })),
      );
    }

    return { profileId: profile.id as string, scores, signals };
  });

export const publishFounderProfile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ profileId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("founder_profiles")
      .update({ published: true })
      .eq("id", data.profileId);
    if (error) throw error;
    return { ok: true };
  });
