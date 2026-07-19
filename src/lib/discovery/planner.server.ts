import type { Thesis } from "@/lib/thesis";
import { SourceRegistry } from "./source-registry.server";
import {
  DISCOVERY_LIMITS,
  type DiscoveryPlan,
  type DiscoveryQuery,
  type DiscoverySource,
  type SourceCapability,
  type SourceDiscoveryPlan,
} from "./types";

const SECTOR_SEARCH_TERMS: Record<string, string[]> = {
  ai: ["artificial intelligence", "machine learning", "llm"],
  climate: ["climate tech", "carbon", "clean energy"],
  fintech: ["fintech", "payments", "banking api"],
  bio: ["biotech", "genomics", "drug discovery"],
  devtools: ["developer tools", "devtools", "developer infrastructure"],
  robotics: ["robotics", "autonomous systems", "computer vision"],
  consumer: ["consumer app", "social platform", "creator tools"],
};

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value: unknown): string {
  const input = stableJson(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function quoteSearchTerm(term: string): string {
  const safe = term.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
  return safe.includes(" ") ? `"${safe}"` : safe;
}

function isoDateDaysAgo(now: Date, days: number): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function normalizedThesisSnapshot(thesis: Thesis) {
  return {
    stages: [...thesis.stages].sort(),
    sectors: [...thesis.sectors].sort(),
    keywords: unique(thesis.keywords ?? []).sort(),
    technicalThemes: unique(thesis.technicalThemes ?? []).sort(),
    preferredLanguages: unique(thesis.preferredLanguages ?? []).sort(),
    founderArchetypes: unique(thesis.founderArchetypes ?? []).sort(),
    desiredSignals: unique(thesis.desiredSignals ?? []).sort(),
    activityRecencyDays: thesis.activityRecencyDays ?? 365,
    exclusions: unique(thesis.exclusions ?? []).sort(),
    technicalBuilderRequired: thesis.technicalBuilderRequired ?? null,
    weights: thesis.weights,
    geos: [...thesis.geos].sort(),
    checkMin: thesis.checkMin,
    checkMax: thesis.checkMax,
  };
}

export class DiscoveryPlanner {
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly capabilities: SourceCapability[] = new SourceRegistry().capabilities(),
  ) {}

  plan(thesis: Thesis): DiscoveryPlan {
    const snapshot = normalizedThesisSnapshot(thesis);
    const recencyDays = Math.min(730, Math.max(30, snapshot.activityRecencyDays));
    const pushedAfter = isoDateDaysAgo(this.now(), recencyDays);
    const languages = snapshot.preferredLanguages.slice(0, 2);
    const sectorTerms = [0, 1, 2].flatMap((termIndex) =>
      snapshot.sectors.flatMap((sector) => {
        const term = (SECTOR_SEARCH_TERMS[normalized(sector)] ?? [sector])[termIndex];
        return term ? [term] : [];
      }),
    );
    const themes = unique([
      ...snapshot.technicalThemes,
      ...snapshot.keywords,
      ...sectorTerms,
    ]).slice(0, DISCOVERY_LIMITS.maxQueries);

    const queryLimit = Math.min(
      DISCOVERY_LIMITS.defaultRepositoriesPerQuery,
      Math.max(1, Math.floor(DISCOVERY_LIMITS.maxRepositories / Math.max(1, themes.length))),
    );
    const queries: DiscoveryQuery[] = themes.map((theme, index) => {
      const language = languages.length > 0 ? languages[index % languages.length] : null;
      const query = [
        quoteSearchTerm(theme),
        "in:name,description,readme",
        language ? `language:${quoteSearchTerm(language)}` : null,
        "archived:false",
        `pushed:>=${pushedAfter}`,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        query,
        reason: language
          ? `Search public repositories matching “${theme}” and preferred language ${language}.`
          : `Search public repositories matching the thesis theme “${theme}”.`,
        limit: queryLimit,
      };
    });

    const unsupportedFilters: DiscoveryPlan["unsupportedFilters"] = [];
    if (snapshot.stages.length > 0) {
      unsupportedFilters.push({
        field: "stages",
        reason: "Startup stage is not reliably observable from GitHub and remains unknown.",
      });
    }
    if (snapshot.geos.length > 0) {
      unsupportedFilters.push({
        field: "geography",
        reason:
          "GitHub location is evaluated after profile retrieval, not used as a search filter.",
      });
    }
    if (snapshot.checkMin > 0 || snapshot.checkMax > 0) {
      unsupportedFilters.push({
        field: "check_size",
        reason: "Check size does not map to verifiable GitHub search metadata.",
      });
    }
    if (snapshot.founderArchetypes.length > 0) {
      unsupportedFilters.push({
        field: "founder_archetypes",
        reason: "Repository ownership does not establish that a person is a startup founder.",
      });
    }
    if (snapshot.exclusions.length > 0) {
      unsupportedFilters.push({
        field: "exclusions",
        reason:
          "Free-text exclusions are retained for review instead of becoming unreliable GitHub filters.",
      });
    }

    const technicalRequired = thesis.technicalBuilderRequired ?? thesis.weights.technical > 0;

    const sourceCapability = (source: DiscoverySource) =>
      this.capabilities.find((capability) => capability.id === source);
    const sourcePlan = (
      source: DiscoverySource,
      sourceQueries: DiscoveryQuery[],
      sourceEvidenceRequirements: string[],
      sourceUnsupported: Array<{ field: string; reason: string }> = [],
    ): SourceDiscoveryPlan => {
      const capability = sourceCapability(source);
      const enabled = Boolean(capability?.enabled);
      return {
        source,
        role: "discovery",
        status: enabled ? "planned" : "disabled_unconfigured",
        queries: enabled ? sourceQueries : sourceQueries,
        themes,
        evidenceRequirements: sourceEvidenceRequirements,
        unsupportedFilters: sourceUnsupported,
        disabledReason: enabled ? undefined : (capability?.disabledReason ?? "Source is disabled."),
      };
    };
    const publicDirectoryQueries = (sourceLabel: string, limit: number): DiscoveryQuery[] =>
      themes.slice(0, DISCOVERY_LIMITS.maxQueries).map((theme) => ({
        query: theme,
        reason: `Filter configured ${sourceLabel} records for the thesis theme “${theme}”.`,
        limit,
      }));

    return {
      thesisId: `local-thesis-${stableHash(snapshot)}`,
      capabilities: this.capabilities,
      sources: [
        sourcePlan("github", queries, [
          "GitHub numeric user ID for canonical identity",
          "Repository owner ID must match the user before ownership is supported",
        ]),
        sourcePlan(
          "hackathon",
          publicDirectoryQueries("hackathon project", DISCOVERY_LIMITS.maxHackathonProjects),
          [
            "A project or team page must explicitly list or link an individual",
            "Results must be explicitly stated by the source",
          ],
          [
            {
              field: "stage",
              reason: "Hackathon participation does not establish company funding stage.",
            },
          ],
        ),
        sourcePlan(
          "accelerator",
          publicDirectoryQueries("accelerator cohort", DISCOVERY_LIMITS.maxAcceleratorCompanies),
          [
            "The cohort page must explicitly identify the founder or co-founder",
            "Cohort participation requires an official directory page",
          ],
          [
            {
              field: "founder_archetype",
              reason: "A directory role is retained verbatim; archetypes are ranking preferences.",
            },
          ],
        ),
        sourcePlan(
          "german_register",
          publicDirectoryQueries("registered business purpose", DISCOVERY_LIMITS.maxCandidates),
          [
            "A permitted structured record must carry a stable register identifier",
            "Legal roles are not converted into founder roles",
          ],
          [
            {
              field: "startup_quality",
              reason:
                "A registration or managing-director role does not establish startup quality.",
            },
          ],
        ),
      ],
      rankingPreferences: unique([
        ...snapshot.sectors.map((sector) => `Evidence-backed ${sector} topic overlap`),
        ...snapshot.technicalThemes.map((theme) => `Evidence-backed ${theme} overlap`),
        ...snapshot.desiredSignals.map((signal) => `Evidence-backed signal: ${signal}`),
        ...(technicalRequired ? ["Supported public build activity"] : []),
        ...(snapshot.geos.length > 0
          ? [`Profile location matching ${snapshot.geos.join(", ")}, when present`]
          : []),
      ]),
      evidenceRequirements: [
        "Stable source identifiers are required for cross-source entity reuse",
        "Thesis matches must resolve to persisted relationship or claim evidence",
        "Discovery query inclusion never proves founding, authorship, funding, stage, or quality",
      ],
      unsupportedFilters,
      candidateLimit: DISCOVERY_LIMITS.defaultCandidateLimit,
    };
  }
}
