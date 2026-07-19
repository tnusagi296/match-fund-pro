import type {
  DiscoveryAdapter,
  DiscoverySource,
  EnrichmentAdapter,
  SourceCapability,
} from "./types";

export type DirectorySourceConfiguration = {
  id: string;
  name: string;
  indexUrl: string;
  itemUrlPattern: string;
  sourcePolicy: "respect_robots" | "configured_allowed";
};

export type GermanRegisterConfiguration = {
  feedUrl: string;
  apiKey: string;
  sourceName: string;
};

export type RedditConfiguration = {
  apiBaseUrl: string;
  apiToken: string;
};

export type SourceRegistryConfiguration = {
  githubToken?: string;
  hackathonDirectories: DirectorySourceConfiguration[];
  acceleratorDirectories: DirectorySourceConfiguration[];
  germanRegister: GermanRegisterConfiguration | null;
  reddit: RedditConfiguration | null;
};

function publicHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function directoryConfigurations(raw: string | undefined): DirectorySourceConfiguration[] {
  if (!raw?.trim()) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const input = item as Record<string, unknown>;
    const indexUrl = publicHttpsUrl(input.indexUrl);
    if (!indexUrl || typeof input.itemUrlPattern !== "string") return [];
    const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : null;
    const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : null;
    if (!name || !id) return [];
    return [
      {
        id,
        name,
        indexUrl,
        itemUrlPattern: input.itemUrlPattern,
        sourcePolicy:
          input.sourcePolicy === "configured_allowed" ? "configured_allowed" : "respect_robots",
      } satisfies DirectorySourceConfiguration,
    ];
  });
}

export function sourceRegistryConfiguration(
  environment: Record<string, string | undefined> = process.env,
): SourceRegistryConfiguration {
  const registerUrl = publicHttpsUrl(environment.GERMAN_REGISTER_FEED_URL);
  const registerKey = environment.GERMAN_REGISTER_API_KEY?.trim();
  const registerName = environment.GERMAN_REGISTER_SOURCE_NAME?.trim();
  const redditUrl = publicHttpsUrl(environment.REDDIT_API_BASE_URL);
  const redditToken = environment.REDDIT_API_TOKEN?.trim();
  return {
    githubToken: environment.GITHUB_TOKEN?.trim() || undefined,
    hackathonDirectories: directoryConfigurations(environment.HACKATHON_DIRECTORY_CONFIG_JSON),
    acceleratorDirectories: directoryConfigurations(environment.ACCELERATOR_DIRECTORY_CONFIG_JSON),
    germanRegister:
      registerUrl && registerKey && registerName
        ? { feedUrl: registerUrl, apiKey: registerKey, sourceName: registerName }
        : null,
    reddit: redditUrl && redditToken ? { apiBaseUrl: redditUrl, apiToken: redditToken } : null,
  };
}

export class SourceRegistry {
  private readonly discoveryAdapters = new Map<DiscoverySource, DiscoveryAdapter>();

  constructor(
    readonly configuration: SourceRegistryConfiguration = sourceRegistryConfiguration(),
    private readonly enrichmentAdapters: EnrichmentAdapter[] = [],
  ) {}

  capabilities(): SourceCapability[] {
    const hackathonConfigured = this.configuration.hackathonDirectories.length > 0;
    const acceleratorConfigured = this.configuration.acceleratorDirectories.length > 0;
    const registerConfigured = Boolean(this.configuration.germanRegister);
    const redditConfigured = Boolean(this.configuration.reddit);
    return [
      {
        id: "github",
        role: "discovery",
        configured: true,
        enabled: true,
        supportsLiveAccess: true,
      },
      {
        id: "hackathon",
        role: "discovery",
        configured: hackathonConfigured,
        enabled: hackathonConfigured,
        supportsLiveAccess: hackathonConfigured,
        disabledReason: hackathonConfigured
          ? undefined
          : "No HACKATHON_DIRECTORY_CONFIG_JSON indexes are configured.",
      },
      {
        id: "accelerator",
        role: "discovery",
        configured: acceleratorConfigured,
        enabled: acceleratorConfigured,
        supportsLiveAccess: acceleratorConfigured,
        disabledReason: acceleratorConfigured
          ? undefined
          : "No ACCELERATOR_DIRECTORY_CONFIG_JSON directories are configured.",
      },
      {
        id: "german_register",
        role: "discovery",
        configured: registerConfigured,
        enabled: registerConfigured,
        supportsLiveAccess: registerConfigured,
        disabledReason: registerConfigured
          ? undefined
          : "A permitted GERMAN_REGISTER_FEED_URL, API key, and source name are required.",
      },
      {
        id: "personal_website",
        role: "enrichment",
        configured: true,
        enabled: true,
        supportsLiveAccess: true,
      },
      {
        id: "company_website",
        role: "enrichment",
        configured: true,
        enabled: true,
        supportsLiveAccess: true,
      },
      {
        id: "linkedin_identifier",
        role: "enrichment",
        configured: true,
        enabled: true,
        supportsLiveAccess: false,
        disabledReason: "Identifier-only: MatchFund never fetches LinkedIn profile pages.",
      },
      {
        id: "reddit",
        role: "enrichment",
        configured: redditConfigured,
        enabled: redditConfigured,
        supportsLiveAccess: redditConfigured,
        disabledReason: redditConfigured
          ? undefined
          : "Reddit API access is unconfigured; linked URLs remain identifiers only.",
      },
    ];
  }

  enabledEnrichmentAdapters(): EnrichmentAdapter[] {
    return this.enrichmentAdapters;
  }

  registerDiscoveryAdapter(source: DiscoverySource, adapter: DiscoveryAdapter): void {
    this.discoveryAdapters.set(source, adapter);
  }

  discoveryAdapter(source: DiscoverySource): DiscoveryAdapter | undefined {
    return this.discoveryAdapters.get(source);
  }

  registeredDiscoveryAdapters(): Partial<Record<DiscoverySource, DiscoveryAdapter>> {
    return Object.fromEntries(this.discoveryAdapters) as Partial<
      Record<DiscoverySource, DiscoveryAdapter>
    >;
  }
}
