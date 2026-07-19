import type {
  GraphClaimInput,
  GraphEntityInput,
  GraphEvidenceInput,
  GraphIngestionResult,
  GraphRelationshipInput,
} from "./types";

const GITHUB_API = "https://api.github.com";
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
  blog?: string | null;
  public_repos: number;
  followers: number;
  created_at: string;
  updated_at: string;
};

export type GitHubRepositorySeed = {
  id: number;
  name: string;
  full_name: string;
  owner: { id: number; login: string };
  private: boolean;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
};

export type GitHubGraphAdapterInput = {
  github: string;
  founderName: string;
  headline?: string;
  linkedin?: string;
  site?: string;
  repositorySeeds?: GitHubRepositorySeed[];
  repositoryLimit?: number;
};

type GitHubGraphAdapterOptions = {
  fetchImpl?: typeof fetch;
  token?: string;
  now?: () => Date;
};

export class GitHubGraphAdapterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubGraphAdapterError";
  }
}

export function parseGitHubLogin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  const looksLikeUrl =
    /^https?:\/\//i.test(candidate) || /^(?:www\.)?github\.com\//i.test(candidate);

  if (looksLikeUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return null;
    }
  } else {
    candidate = candidate.replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  }

  return GITHUB_LOGIN.test(candidate) ? candidate : null;
}

export function stableGitHubEntityKey(kind: "user" | "repository", id: number | string): string {
  return `github:${kind}:${String(id)}`;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function selectedUserPayload(user: GitHubUser) {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    bio: user.bio,
    location: user.location,
    blog: user.blog ?? null,
    public_repos: user.public_repos,
    updated_at: user.updated_at,
  };
}

function selectedRepositoryPayload(repository: GitHubRepositorySeed) {
  return {
    id: repository.id,
    name: repository.name,
    full_name: repository.full_name,
    owner: { id: repository.owner.id, login: repository.owner.login },
    fork: repository.fork,
    archived: repository.archived,
    html_url: repository.html_url,
    description: repository.description,
    language: repository.language,
    topics: repository.topics ?? [],
    updated_at: repository.updated_at,
    pushed_at: repository.pushed_at,
  };
}

export class GitHubGraphAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly token?: string;
  private readonly now: () => Date;

  constructor(options: GitHubGraphAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.token = options.token;
    this.now = options.now ?? (() => new Date());
  }

  async ingest(input: GitHubGraphAdapterInput): Promise<GraphIngestionResult> {
    const login = parseGitHubLogin(input.github);
    if (!login) {
      throw new GitHubGraphAdapterError(
        "Enter a GitHub username or a full profile URL such as https://github.com/octocat.",
      );
    }

    const user = await this.getJson<GitHubUser>(`/users/${encodeURIComponent(login)}`);
    const recentRepositories = await this.getRepositories(user, input.repositoryLimit);
    const repositoryLimit = input.repositoryLimit ?? Number.POSITIVE_INFINITY;
    const repositories = [...(input.repositorySeeds ?? []), ...recentRepositories]
      .filter(
        (repository, index, all) =>
          all.findIndex((candidate) => candidate.id === repository.id) === index,
      )
      .filter((repository) => !repository.private && !repository.disabled && !repository.archived)
      .slice(0, repositoryLimit);
    const retrievedAt = this.now().toISOString();

    return this.normalize(input, user, repositories, retrievedAt);
  }

  private async getRepositories(
    user: GitHubUser,
    requestedLimit?: number,
  ): Promise<GitHubRepositorySeed[]> {
    const limit =
      requestedLimit === undefined
        ? Math.max(1, user.public_repos)
        : Math.max(1, Math.min(requestedLimit, user.public_repos || requestedLimit));
    const perPage = Math.min(100, limit);
    const pageCount = Math.max(1, Math.ceil(limit / perPage));
    const repositories: GitHubRepositorySeed[] = [];

    for (let page = 1; page <= pageCount; page += 1) {
      const result = await this.getJson<GitHubRepositorySeed[]>(
        `/users/${encodeURIComponent(user.login)}/repos?per_page=${perPage}&type=owner&sort=pushed&page=${page}`,
      );
      repositories.push(...result);
      if (result.length < perPage || repositories.length >= limit) break;
    }

    return repositories
      .filter((repository) => !repository.private && !repository.disabled && !repository.archived)
      .slice(0, limit);
  }

  private async getJson<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "MatchFund-evidence-graph",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await this.fetchImpl(`${GITHUB_API}${path}`, { headers });
    if (!response.ok) {
      const suffix = response.status === 404 ? " GitHub profile not found." : "";
      throw new GitHubGraphAdapterError(
        `GitHub request failed with status ${response.status}.${suffix}`.trim(),
        response.status,
      );
    }
    return (await response.json()) as T;
  }

  private async normalize(
    input: GitHubGraphAdapterInput,
    user: GitHubUser,
    repositories: GitHubRepositorySeed[],
    retrievedAt: string,
  ): Promise<GraphIngestionResult> {
    const entities: GraphEntityInput[] = [];
    const relationships: GraphRelationshipInput[] = [];
    const claims: GraphClaimInput[] = [];
    const evidence: GraphEvidenceInput[] = [];

    const founderTempId = `founder:${user.id}`;
    const sourceTempId = "source:github";
    const userPayload = selectedUserPayload(user);
    const userHash = await sha256({
      source: "github_user",
      externalId: user.id,
      payload: userPayload,
    });
    const userEvidenceTempId = `evidence:github-user:${user.id}:${userHash.slice(0, 12)}`;
    let publicWebsite: string | null = null;
    if (user.blog?.trim()) {
      try {
        const candidate = new URL(
          /^https?:\/\//i.test(user.blog) ? user.blog : `https://${user.blog}`,
        );
        if (["http:", "https:"].includes(candidate.protocol)) {
          candidate.protocol = "https:";
          candidate.hash = "";
          publicWebsite = candidate.href;
        }
      } catch {
        // GitHub's free-text blog field is ignored when it is not a public URL.
      }
    }

    entities.push(
      {
        tempId: founderTempId,
        entityType: "founder",
        canonicalKey: stableGitHubEntityKey("user", user.id),
        canonicalName: input.founderName.trim() || user.name || user.login,
        properties: {
          githubUserId: user.id,
          githubLogin: user.login,
          githubUrl: user.html_url,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          location: user.location,
          headline: input.headline ?? "",
          linkedin: input.linkedin || null,
          site: input.site || publicWebsite,
          blog: publicWebsite,
        },
        identifiers: [
          { scheme: "github_user_id", value: String(user.id) },
          { scheme: "github_login", value: user.login.toLowerCase() },
          ...(publicWebsite
            ? ([
                { scheme: "personal_website_url", value: publicWebsite },
              ] satisfies GraphEntityInput["identifiers"])
            : []),
        ],
      },
      {
        tempId: sourceTempId,
        entityType: "source",
        canonicalKey: "source:github",
        canonicalName: "GitHub",
        properties: { sourceType: "github", baseUrl: "https://github.com" },
        identifiers: [],
      },
    );

    evidence.push({
      tempId: userEvidenceTempId,
      sourceType: "github_user",
      sourceUrl: user.html_url,
      sourceExternalId: String(user.id),
      retrievedAt,
      excerpt: `GitHub profile @${user.login}${user.location ? ` lists location “${user.location}”` : ""}: ${user.public_repos} public repositories; updated ${user.updated_at.slice(0, 10)}.`,
      rawPayload: userPayload,
      contentHash: userHash,
      reliability: 0.95,
      pageTitle: `${user.name ?? user.login} (${user.login}) · GitHub`,
      extractionMethod: "github_api",
      trustLevel: "high",
      metadata: { sourceName: "GitHub profile", apiUrl: `${GITHUB_API}/users/${user.login}` },
    });

    relationships.push({
      tempId: `relationship:${founderTempId}:HAS_PROFILE:${sourceTempId}`,
      sourceTempId: founderTempId,
      targetTempId: sourceTempId,
      relationshipType: "HAS_PROFILE",
      confidence: 0.99,
      observedAt: retrievedAt,
      validFrom: null,
      validTo: null,
      properties: { profileUrl: user.html_url, login: user.login },
      evidenceTempIds: [userEvidenceTempId],
    });

    claims.push({
      tempId: `claim:${founderTempId}:github_profile`,
      subjectTempId: founderTempId,
      predicate: "github_profile",
      value: { userId: user.id, login: user.login, url: user.html_url, blog: publicWebsite },
      status: "supported",
      trustLevel: "high",
      observedAt: retrievedAt,
      evidenceTempIds: [userEvidenceTempId],
    });

    for (const repository of repositories) {
      const repositoryTempId = `repository:${repository.id}`;
      const repositoryPayload = selectedRepositoryPayload(repository);
      const repositoryHash = await sha256({
        source: "github_repository",
        externalId: repository.id,
        payload: repositoryPayload,
      });
      const repositoryEvidenceTempId = `evidence:github-repository:${repository.id}:${repositoryHash.slice(0, 12)}`;
      // GitHub's immutable numeric owner ID is the canonical ownership check.
      // Logins can change and are therefore identifiers, not the identity key.
      const ownershipEstablished = repository.owner.id === user.id;

      entities.push({
        tempId: repositoryTempId,
        entityType: "repository",
        canonicalKey: stableGitHubEntityKey("repository", repository.id),
        canonicalName: repository.full_name,
        properties: repositoryPayload,
        identifiers: [
          { scheme: "github_repo_id", value: String(repository.id) },
          { scheme: "github_repo_full_name", value: repository.full_name.toLowerCase() },
        ],
      });

      evidence.push({
        tempId: repositoryEvidenceTempId,
        sourceType: "github_repository",
        sourceUrl: repository.html_url,
        sourceExternalId: String(repository.id),
        retrievedAt,
        excerpt: `${repository.full_name} is a public GitHub repository${repository.language ? ` using ${repository.language}` : ""}${repository.topics?.length ? ` with topics ${repository.topics.join(", ")}` : ""}; last pushed ${repository.pushed_at?.slice(0, 10) ?? "unknown"}.`,
        rawPayload: repositoryPayload,
        contentHash: repositoryHash,
        reliability: 0.95,
        pageTitle: `${repository.full_name} · GitHub`,
        extractionMethod: "github_api",
        trustLevel: "high",
        metadata: {
          sourceName: "GitHub repository",
          apiUrl: `${GITHUB_API}/repositories/${repository.id}`,
        },
      });

      relationships.push({
        tempId: `relationship:${repositoryTempId}:SUPPORTED_BY:${sourceTempId}`,
        sourceTempId: repositoryTempId,
        targetTempId: sourceTempId,
        relationshipType: "SUPPORTED_BY",
        confidence: 0.99,
        observedAt: retrievedAt,
        validFrom: null,
        validTo: null,
        properties: {},
        evidenceTempIds: [repositoryEvidenceTempId],
      });

      if (ownershipEstablished) {
        relationships.push({
          tempId: `relationship:${founderTempId}:OWNS_REPOSITORY:${repositoryTempId}`,
          sourceTempId: founderTempId,
          targetTempId: repositoryTempId,
          relationshipType: "OWNS_REPOSITORY",
          confidence: 0.99,
          observedAt: retrievedAt,
          validFrom: null,
          validTo: null,
          properties: { fork: repository.fork, ownershipBasis: "GitHub repository owner ID" },
          evidenceTempIds: [repositoryEvidenceTempId],
        });
        claims.push({
          tempId: `claim:${founderTempId}:owns_repository:${repository.id}`,
          subjectTempId: founderTempId,
          predicate: "owns_repository",
          value: {
            repositoryId: repository.id,
            fullName: repository.full_name,
            repositoryEntityKey: stableGitHubEntityKey("repository", repository.id),
          },
          status: "supported",
          trustLevel: "high",
          observedAt: retrievedAt,
          evidenceTempIds: [repositoryEvidenceTempId],
        });
      }

      if (repository.language) {
        const languageKey = slug(repository.language);
        const languageTempId = `skill:language:${languageKey}`;
        if (!entities.some((entity) => entity.tempId === languageTempId)) {
          entities.push({
            tempId: languageTempId,
            entityType: "skill",
            canonicalKey: `language:${languageKey}`,
            canonicalName: repository.language,
            properties: { category: "programming_language" },
            identifiers: [],
          });
        }
        relationships.push({
          tempId: `relationship:${repositoryTempId}:USES_LANGUAGE:${languageTempId}`,
          sourceTempId: repositoryTempId,
          targetTempId: languageTempId,
          relationshipType: "USES_LANGUAGE",
          confidence: 0.9,
          observedAt: retrievedAt,
          validFrom: null,
          validTo: null,
          properties: { basis: "GitHub primary language" },
          evidenceTempIds: [repositoryEvidenceTempId],
        });
        claims.push({
          tempId: `claim:${repositoryTempId}:primary_language:${languageKey}`,
          subjectTempId: repositoryTempId,
          predicate: "primary_language",
          value: repository.language,
          status: "supported",
          trustLevel: "high",
          observedAt: retrievedAt,
          evidenceTempIds: [repositoryEvidenceTempId],
        });
      }

      for (const topic of repository.topics ?? []) {
        const topicKey = slug(topic);
        if (!topicKey) continue;
        const topicTempId = `sector:github-topic:${topicKey}`;
        if (!entities.some((entity) => entity.tempId === topicTempId)) {
          entities.push({
            tempId: topicTempId,
            entityType: "sector",
            canonicalKey: `github-topic:${topicKey}`,
            canonicalName: topic,
            properties: { category: "github_topic" },
            identifiers: [],
          });
        }
        relationships.push({
          tempId: `relationship:${repositoryTempId}:FOCUSES_ON:${topicTempId}`,
          sourceTempId: repositoryTempId,
          targetTempId: topicTempId,
          relationshipType: "FOCUSES_ON",
          confidence: 0.85,
          observedAt: retrievedAt,
          validFrom: null,
          validTo: null,
          properties: { basis: "GitHub repository topic" },
          evidenceTempIds: [repositoryEvidenceTempId],
        });
      }

      if (repository.topics?.length) {
        claims.push({
          tempId: `claim:${repositoryTempId}:topics`,
          subjectTempId: repositoryTempId,
          predicate: "repository_topics",
          value: [...repository.topics].sort(),
          status: "supported",
          trustLevel: "high",
          observedAt: retrievedAt,
          evidenceTempIds: [repositoryEvidenceTempId],
        });
      }

      if (repository.pushed_at) {
        claims.push({
          tempId: `claim:${repositoryTempId}:recent_activity:${repository.pushed_at}`,
          subjectTempId: repositoryTempId,
          predicate: "repository_last_pushed_at",
          value: repository.pushed_at,
          status: "supported",
          trustLevel: "high",
          observedAt: retrievedAt,
          evidenceTempIds: [repositoryEvidenceTempId],
        });
      }
    }

    return { entities, relationships, claims, evidence };
  }
}
