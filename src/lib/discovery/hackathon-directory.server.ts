import { HackathonEvidenceAdapter } from "@/lib/graph/hackathon-evidence.server";
import type { GraphIdentifierInput } from "@/lib/graph/types";
import type { Thesis } from "@/lib/thesis";
import { founderEntity, identifierForUrl, mergeGraphs, slug } from "./graph-builders.server";
import { DiscoveryPlanner } from "./planner.server";
import { fetchPublicHtml } from "./safe-fetch.server";
import type { DirectorySourceConfiguration } from "./source-registry.server";
import {
  anchors,
  attribute,
  canonicalHttpsUrl,
  jsonLdObjects,
  metaContent,
  pageTitle,
  visibleText,
} from "./source-utils.server";
import { DISCOVERY_LIMITS } from "./types";
import type {
  DiscoveryAdapter,
  DiscoveryReason,
  DiscoveryResult,
  PublicDiscoveryCandidate,
  SourceDiscoveryIssue,
  SourceDiscoveryPlan,
} from "./types";

type HackathonDirectoryAdapterOptions = {
  configurations: DirectorySourceConfiguration[];
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type LinkedParticipant = {
  name: string;
  role: string | null;
  url: string;
  identifier: GraphIdentifierInput;
};

function dataAttribute(html: string, name: string): string | null {
  const match = html.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2]?.trim() || null;
}

function participantUrls(html: string, baseUrl: string): LinkedParticipant[] {
  const participants: LinkedParticipant[] = [];
  for (const anchor of anchors(html, baseUrl)) {
    const explicitlyListed =
      /\bdata-(?:participant|team-member)(?:\s|=)/i.test(anchor.attributes) ||
      /\brel=["'][^"']*author/i.test(anchor.attributes);
    if (!explicitlyListed) continue;
    const identifier = identifierForUrl(anchor.href);
    if (!identifier) continue;
    const name =
      attribute(anchor.attributes, "data-participant-name") ??
      attribute(anchor.attributes, "data-team-member") ??
      anchor.text;
    if (!name.trim()) continue;
    participants.push({
      name: name.trim(),
      role: attribute(anchor.attributes, "data-role"),
      url: identifier.value,
      identifier,
    });
  }

  const structuredPeople = jsonLdObjects(html).flatMap((item) => {
    const nested = [item.creator, item.author, item.contributor, item.member].flatMap((value) =>
      Array.isArray(value) ? value : value ? [value] : [],
    );
    return [item, ...nested].filter((value): value is Record<string, unknown> =>
      Boolean(value && typeof value === "object" && !Array.isArray(value)),
    );
  });
  for (const item of structuredPeople) {
    const type = item["@type"];
    if (type !== "Person") continue;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const urls = [item.url, ...(Array.isArray(item.sameAs) ? item.sameAs : [])].filter(
      (value): value is string => typeof value === "string",
    );
    for (const url of urls) {
      const identifier = identifierForUrl(url);
      if (!name || !identifier) continue;
      participants.push({
        name,
        role: typeof item.jobTitle === "string" ? item.jobTitle : null,
        url: identifier.value,
        identifier,
      });
      break;
    }
  }
  return [
    ...new Map(
      participants.map((participant) => [
        `${participant.identifier.scheme}:${participant.identifier.value}`,
        participant,
      ]),
    ).values(),
  ].slice(0, DISCOVERY_LIMITS.maxProjectTeamMembers);
}

function urlsForParticipant(participant: LinkedParticipant) {
  const value = participant.identifier.value;
  return {
    github: participant.identifier.scheme === "github_login" ? `https://github.com/${value}` : null,
    personalWebsite: participant.identifier.scheme === "personal_website_url" ? value : null,
    linkedin: participant.identifier.scheme === "linkedin_url" ? value : null,
    reddit: participant.identifier.scheme === "reddit_url" ? value : null,
  };
}

function issue(
  sourceName: string,
  message: string,
  status: number | null = null,
): SourceDiscoveryIssue {
  return {
    source: "hackathon",
    query: sourceName,
    status,
    message,
    rateLimited: status === 429,
    rateLimitResetAt: null,
  };
}

export class HackathonDirectoryAdapter implements DiscoveryAdapter {
  private readonly fetchImpl?: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly options: HackathonDirectoryAdapterOptions) {
    this.fetchImpl = options.fetchImpl;
    this.now = options.now ?? (() => new Date());
  }

  async plan(thesis: Thesis): Promise<SourceDiscoveryPlan> {
    const plan = new DiscoveryPlanner()
      .plan(thesis)
      .sources.find((item) => item.source === "hackathon");
    if (!plan) throw new Error("Hackathon discovery plan was not generated.");
    return plan;
  }

  async discover(plan: SourceDiscoveryPlan): Promise<DiscoveryResult> {
    if (plan.source !== "hackathon") throw new Error("Hackathon adapter received the wrong plan.");
    if (this.options.configurations.length === 0) {
      return {
        source: "hackathon",
        status: "disabled_unconfigured",
        candidates: [],
        queriesExecuted: 0,
        recordsEvaluated: 0,
        skipped: 0,
        issues: [issue("hackathon", "No configured hackathon directory is available.")],
      };
    }

    const candidates = new Map<string, PublicDiscoveryCandidate>();
    const issues: SourceDiscoveryIssue[] = [];
    let recordsEvaluated = 0;
    let queriesExecuted = 0;
    let skipped = 0;
    for (const configuration of this.options.configurations.slice(
      0,
      DISCOVERY_LIMITS.maxHackathonIndexes,
    )) {
      let pattern: RegExp;
      try {
        pattern = new RegExp(configuration.itemUrlPattern, "i");
      } catch {
        issues.push(issue(configuration.name, "Configured project URL pattern is invalid."));
        continue;
      }
      let indexHtml: string;
      try {
        indexHtml = (await fetchPublicHtml(configuration.indexUrl, { fetchImpl: this.fetchImpl }))
          .html;
        queriesExecuted += 1;
      } catch (error) {
        issues.push(
          issue(configuration.name, error instanceof Error ? error.message : "Index fetch failed."),
        );
        continue;
      }
      const projectUrls = [
        ...new Set(
          anchors(indexHtml, configuration.indexUrl)
            .filter((anchor) => pattern.test(new URL(anchor.href).pathname))
            .map((anchor) => canonicalHttpsUrl(anchor.href))
            .filter((url): url is string => Boolean(url)),
        ),
      ].slice(0, DISCOVERY_LIMITS.maxHackathonProjects);

      for (const projectUrl of projectUrls) {
        let html: string;
        try {
          html = (await fetchPublicHtml(projectUrl, { fetchImpl: this.fetchImpl })).html;
        } catch (error) {
          issues.push(
            issue(
              configuration.name,
              error instanceof Error ? error.message : "Project fetch failed.",
            ),
          );
          continue;
        }
        recordsEvaluated += 1;
        const text = visibleText(html);
        const matchingQueries = plan.queries.filter((query) =>
          text.toLowerCase().includes(query.query.toLowerCase()),
        );
        if (plan.queries.length > 0 && matchingQueries.length === 0) {
          skipped += 1;
          continue;
        }
        const participants = participantUrls(html, projectUrl);
        if (participants.length === 0) {
          skipped += 1;
          continue;
        }
        const structuredEvent = jsonLdObjects(html)
          .flatMap((item) => {
            const nested = item.isPartOf;
            return [
              ...(item["@type"] === "Event" ? [item] : []),
              ...(nested && typeof nested === "object" && !Array.isArray(nested)
                ? [nested as Record<string, unknown>]
                : []),
            ];
          })
          .find((item) => item["@type"] === "Event");
        const structuredEventUrl =
          typeof structuredEvent?.url === "string" ? structuredEvent.url : null;
        const structuredEventName =
          typeof structuredEvent?.name === "string" ? structuredEvent.name : null;
        const eventUrl = canonicalHttpsUrl(
          dataAttribute(html, "data-event-url") ??
            metaContent(html, "matchfund:event_url") ??
            structuredEventUrl ??
            configuration.indexUrl,
        );
        const eventName =
          dataAttribute(html, "data-event-name") ??
          metaContent(html, "matchfund:event_name") ??
          structuredEventName ??
          configuration.name;
        const projectName =
          dataAttribute(html, "data-project-name") ??
          metaContent(html, "og:title") ??
          pageTitle(html) ??
          "Hackathon project";

        for (const participant of participants) {
          try {
            const tempId = `founder:hackathon:${slug(participant.identifier.value)}`;
            const founder = founderEntity(tempId, participant.name, [participant.identifier], {
              ...urlsForParticipant(participant),
              discoverySource: configuration.name,
            });
            const graph = await new HackathonEvidenceAdapter({
              fetchImpl: this.fetchImpl,
              now: this.now,
              useAi: false,
              validateDns: !this.fetchImpl,
            }).ingest({
              projectUrl,
              eventUrl: eventUrl ?? undefined,
              eventName,
              projectName,
              claimedRole: participant.role ?? undefined,
              founder,
            });
            const reasons: DiscoveryReason[] = (
              matchingQueries.length > 0 ? matchingQueries : plan.queries.slice(0, 1)
            ).map((query) => ({
              source: "hackathon",
              query: query.query,
              planReason: query.reason,
              sourceName: configuration.name,
              resultName: projectName,
              resultUrl: projectUrl,
            }));
            const key = `${participant.identifier.scheme}:${participant.identifier.value}`;
            const existing = candidates.get(key);
            const candidate: PublicDiscoveryCandidate = {
              source: "hackathon",
              sourceIdentifier: key,
              displayName: participant.name,
              sourceUrl: projectUrl,
              explicitFounderRole: false,
              identifiers: [participant.identifier],
              urls: urlsForParticipant(participant),
              discoveryReasons: reasons,
              graph,
              context: {
                directoryId: configuration.id,
                directoryName: configuration.name,
                eventName,
                projectName,
              },
            };
            candidates.set(
              key,
              existing
                ? {
                    ...existing,
                    graph: mergeGraphs(existing.graph, graph),
                    discoveryReasons: [...existing.discoveryReasons, ...reasons],
                  }
                : candidate,
            );
          } catch (error) {
            issues.push(
              issue(
                configuration.name,
                `Evidence validation failed for ${participant.name}: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
          }
        }
      }
    }
    const values = [...candidates.values()].slice(0, DISCOVERY_LIMITS.maxCandidates);
    return {
      source: "hackathon",
      status: issues.length > 0 ? (values.length > 0 ? "partial" : "failed") : "completed",
      candidates: values,
      queriesExecuted,
      recordsEvaluated,
      skipped,
      issues,
    };
  }
}
