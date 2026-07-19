import type { Thesis } from "@/lib/thesis";
import type {
  EvidencePath,
  GraphEvidenceReference,
  GraphFounderCard,
  RankedGraphFounder,
  ThesisFitResult,
} from "./types";

const SECTOR_TERMS: Record<string, string[]> = {
  ai: ["ai", "artificial intelligence", "machine learning", "ml", "llm", "generative ai"],
  climate: ["climate", "carbon", "energy", "sustainability", "cleantech"],
  fintech: ["fintech", "finance", "payments", "banking", "crypto", "accounting"],
  bio: ["bio", "biotech", "health", "drug", "protein", "genomics"],
  devtools: ["devtools", "developer tools", "sdk", "api", "database", "infrastructure"],
  robotics: ["robotics", "robot", "autonomous", "computer vision", "sensors"],
  consumer: ["consumer", "mobile", "social", "commerce", "creator"],
};

type Criterion = { weight: number; score: number };

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

function termsFor(value: string): string[] {
  const key = normalized(value).replace(/\s+/g, "");
  return [...new Set([normalized(value), ...(SECTOR_TERMS[key] ?? [])].map(normalized))];
}

function textMatches(text: string, terms: string[]): boolean {
  const haystack = ` ${normalized(text)} `;
  return terms.some((term) => {
    if (!term) return false;
    if (term.length <= 3) return haystack.split(/\s+/).includes(term);
    return haystack.includes(term);
  });
}

function evidencePath(criterion: string, reference: GraphEvidenceReference): EvidencePath {
  return {
    criterion,
    graphStep: reference.graphStep,
    evidenceExcerpt: reference.evidenceExcerpt,
    sourceName: reference.sourceName,
    sourceUrl: reference.sourceUrl,
    trustLevel: reference.trustLevel,
    observedAt: reference.observedAt,
  };
}

function inferGeography(location: string): string {
  const value = normalized(location);
  if (
    /(san francisco|new york|austin|boston|seattle|united states| usa | california)/.test(
      ` ${value} `,
    )
  )
    return "US";
  if (/(london|berlin|paris|amsterdam|zurich|barcelona|dublin|stockholm|lisbon|europe)/.test(value))
    return "EU";
  if (/(singapore|tokyo|seoul|shanghai|beijing|bangalore|mumbai|hong kong|asia)/.test(value))
    return "Asia";
  if (/(sao paulo|mexico|buenos aires|santiago|bogot|latam)/.test(value)) return "LatAm";
  if (/(lagos|nairobi|cape town|cairo|johannesburg|africa)/.test(value)) return "Africa";
  if (/remote/.test(value)) return "Remote";
  return "Other";
}

function findReference(
  founder: GraphFounderCard,
  kinds: GraphEvidenceReference["kind"][],
  terms: string[] = [],
): GraphEvidenceReference | null {
  return (
    founder.evidenceReferences.find(
      (reference) =>
        kinds.includes(reference.kind) &&
        (terms.length === 0 ||
          textMatches(
            [reference.value, reference.repositoryName ?? "", reference.evidenceExcerpt].join(" "),
            terms,
          )),
    ) ?? null
  );
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value);
}

export function calculateGraphThesisFit(
  founder: GraphFounderCard,
  thesis: Thesis,
): ThesisFitResult {
  const matchedCriteria: string[] = [];
  const unknownCriteria: string[] = [];
  const paths: EvidencePath[] = [];
  const criteria: Criterion[] = [];

  if (thesis.sectors.length > 0) {
    if (founder.topics.length === 0) {
      unknownCriteria.push("Sector/topic fit: repository topics are unavailable");
    } else {
      const matches = thesis.sectors.filter((sector) =>
        founder.topics.some((topic) => textMatches(topic, termsFor(sector))),
      );
      criteria.push({ weight: 30, score: matches.length > 0 ? 100 : 0 });
      for (const sector of matches) {
        const criterion = `${sector} sector/topic overlap`;
        pushUnique(matchedCriteria, criterion);
        const reference = findReference(founder, ["topic"], termsFor(sector));
        if (reference) paths.push(evidencePath(criterion, reference));
      }
    }
  }

  const keywords = [...new Set([...(thesis.keywords ?? []), ...thesis.sectors])];
  if (keywords.length > 0) {
    if (founder.repositoryText.length === 0) {
      unknownCriteria.push("Keyword similarity: repository metadata is unavailable");
    } else {
      const matchingKeywords = keywords.filter((keyword) =>
        founder.repositoryText.some((text) => textMatches(text, termsFor(keyword))),
      );
      criteria.push({
        weight: 20,
        score: Math.round((matchingKeywords.length / Math.max(1, keywords.length)) * 100),
      });
      for (const keyword of matchingKeywords) {
        const criterion = `Repository metadata matches “${keyword}”`;
        pushUnique(matchedCriteria, criterion);
        const reference = findReference(
          founder,
          ["topic", "language", "repository_ownership"],
          termsFor(keyword),
        );
        if (reference) paths.push(evidencePath(criterion, reference));
      }
    }
  }

  const requiresTechnicalBuilder = thesis.technicalBuilderRequired ?? thesis.weights.technical > 0;
  if (requiresTechnicalBuilder) {
    if (founder.sourceCount === 0) {
      unknownCriteria.push("Technical-builder requirement: no usable public evidence");
    } else {
      const technicalMatch = founder.repositoryCount > 0;
      criteria.push({ weight: 35, score: technicalMatch ? 100 : 0 });
      if (technicalMatch) {
        const criterion = "Technical-builder requirement supported by public repositories";
        pushUnique(matchedCriteria, criterion);
        const technicalReferences = founder.evidenceReferences.filter((reference) =>
          ["repository_ownership", "language", "recent_activity"].includes(reference.kind),
        );
        for (const reference of technicalReferences.slice(0, 3)) {
          paths.push(evidencePath(criterion, reference));
        }
      }
    }
  }

  if (thesis.geos.length > 0) {
    if (!founder.location) {
      unknownCriteria.push("Geography: not provided");
    } else {
      const geography = inferGeography(founder.location);
      const matched = thesis.geos.includes(geography);
      criteria.push({ weight: 10, score: matched ? 100 : 0 });
      if (matched) {
        const criterion = `${geography} geography`;
        pushUnique(matchedCriteria, criterion);
        const reference = findReference(founder, ["profile"]);
        if (reference) paths.push(evidencePath(criterion, reference));
      }
    }
  }

  if (thesis.stages.length > 0) {
    if (!founder.stage) {
      unknownCriteria.push("Stage: not provided");
    } else {
      const matched = thesis.stages.includes(founder.stage as Thesis["stages"][number]);
      criteria.push({ weight: 5, score: matched ? 100 : 0 });
      if (matched) pushUnique(matchedCriteria, `${founder.stage} stage`);
    }
  }

  const denominator = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const score =
    denominator === 0
      ? 0
      : Math.round(
          criteria.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0) /
            denominator,
        );

  const uniquePaths = [
    ...new Map(
      paths.map((path) => [`${path.criterion}:${path.graphStep}:${path.sourceUrl}`, path]),
    ).values(),
  ];

  return {
    score,
    matchedCriteria,
    unknownCriteria,
    evidencePaths: uniquePaths.slice(0, 5),
  };
}

export function discoveryPriority(fit: ThesisFitResult, founder: GraphFounderCard): number {
  const coverageBonus =
    founder.evidenceConfidence === "High"
      ? 10
      : founder.evidenceConfidence === "Medium"
        ? 6
        : founder.evidenceConfidence === "Low"
          ? 2
          : 0;
  return Math.min(100, Math.round(fit.score * 0.9 + coverageBonus));
}

export function rankGraphFounders(
  founders: GraphFounderCard[],
  thesis: Thesis,
): RankedGraphFounder[] {
  return founders
    .map((founder) => {
      const thesisFit = calculateGraphThesisFit(founder, thesis);
      return { founder, thesisFit, discoveryPriority: discoveryPriority(thesisFit, founder) };
    })
    .sort(
      (a, b) =>
        b.discoveryPriority - a.discoveryPriority ||
        b.founder.repositoryCount - a.founder.repositoryCount ||
        a.founder.name.localeCompare(b.founder.name),
    );
}
