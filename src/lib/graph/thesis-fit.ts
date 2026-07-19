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
  for (const kind of kinds) {
    const reference = founder.evidenceReferences.find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.supportStatus === "supported" &&
        (terms.length === 0 ||
          textMatches(
            [
              candidate.value,
              candidate.repositoryName ?? "",
              candidate.entityName ?? "",
              candidate.evidenceExcerpt,
            ].join(" "),
            terms,
          )),
    );
    if (reference) return reference;
  }
  return null;
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
    const supportedProjectTechnologies = founder.evidenceReferences
      .filter(
        (reference) =>
          reference.kind === "project_technology" && reference.supportStatus === "supported",
      )
      .map((reference) => reference.value);
    const graphTopics = [...founder.topics, ...supportedProjectTechnologies];
    if (graphTopics.length === 0) {
      unknownCriteria.push(
        "Sector/topic fit: supported repository or project metadata is unavailable",
      );
    } else {
      const matches = thesis.sectors.filter((sector) =>
        graphTopics.some((topic) => textMatches(topic, termsFor(sector))),
      );
      criteria.push({ weight: 30, score: matches.length > 0 ? 100 : 0 });
      for (const sector of matches) {
        const criterion = `${sector} sector/topic overlap`;
        pushUnique(matchedCriteria, criterion);
        const reference = findReference(founder, ["topic", "project_technology"], termsFor(sector));
        if (reference) paths.push(evidencePath(criterion, reference));
      }
    }
  }

  const keywords = [...new Set([...(thesis.keywords ?? []), ...thesis.sectors])];
  if (keywords.length > 0) {
    if (founder.repositoryText.length === 0) {
      unknownCriteria.push(
        "Keyword similarity: supported repository and project metadata is unavailable",
      );
    } else {
      const matchingKeywords = keywords.filter((keyword) =>
        founder.repositoryText.some((text) => textMatches(text, termsFor(keyword))),
      );
      criteria.push({
        weight: 20,
        score: Math.round((matchingKeywords.length / Math.max(1, keywords.length)) * 100),
      });
      for (const keyword of matchingKeywords) {
        const criterion = `Graph-backed project or repository metadata matches “${keyword}”`;
        pushUnique(matchedCriteria, criterion);
        const reference = findReference(
          founder,
          [
            "topic",
            "language",
            "repository_ownership",
            "project_technology",
            "project_submission",
            "project_contribution",
            "website_technology",
            "company_founder",
            "accelerator_participation",
          ],
          termsFor(keyword),
        );
        if (reference) paths.push(evidencePath(criterion, reference));
      }
    }
  }

  const requiresTechnicalBuilder = thesis.technicalBuilderRequired ?? thesis.weights.technical > 0;
  if (requiresTechnicalBuilder) {
    const technicalReferences = founder.evidenceReferences.filter(
      (reference) =>
        [
          "repository_ownership",
          "language",
          "recent_activity",
          "project_contribution",
          "project_technology",
        ].includes(reference.kind) && reference.supportStatus === "supported",
    );
    if (technicalReferences.length === 0) {
      unknownCriteria.push(
        "Technical-builder requirement: no supported repository ownership or project-contribution evidence",
      );
    } else {
      criteria.push({ weight: 35, score: 100 });
      const criterion = "Technical-builder requirement supported by public build evidence";
      pushUnique(matchedCriteria, criterion);
      for (const reference of technicalReferences.slice(0, 3)) {
        paths.push(evidencePath(criterion, reference));
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
      const hackathonReference = thesis.stages.includes("Hackathon")
        ? findReference(founder, ["project_submission", "hackathon_participation"])
        : null;
      if (hackathonReference) {
        criteria.push({ weight: 5, score: 100 });
        const criterion = "Hackathon-stage activity supported by public project evidence";
        pushUnique(matchedCriteria, criterion);
        paths.push(evidencePath(criterion, hackathonReference));
      } else {
        unknownCriteria.push("Stage: not provided");
      }
    } else {
      const matched = thesis.stages.includes(founder.stage as Thesis["stages"][number]);
      criteria.push({ weight: 5, score: matched ? 100 : 0 });
      if (matched) pushUnique(matchedCriteria, `${founder.stage} stage`);
    }
  }

  if (thesis.weights.traction > 0) {
    const resultReference = findReference(founder, ["hackathon_result"]);
    if (resultReference) {
      criteria.push({ weight: 15, score: 100 });
      const criterion = "Public source verifies a hackathon result";
      pushUnique(matchedCriteria, criterion);
      paths.push(evidencePath(criterion, resultReference));
    } else if (founder.projects.length > 0) {
      unknownCriteria.push("Hackathon result: no supported finalist, winner, or prize evidence");
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
  ].sort((a, b) => {
    const priority = (path: EvidencePath) => {
      if (/\b(WON_AT|FINALIST_AT|RECEIVED_PRIZE_AT)\b/.test(path.graphStep)) return 0;
      if (/\bSUBMITTED_TO\b/.test(path.graphStep)) return 1;
      if (/\bPARTICIPATED_IN\b/.test(path.graphStep)) return 2;
      if (/\bUSES_TECHNOLOGY\b/.test(path.graphStep)) return 3;
      return 4;
    };
    return priority(a) - priority(b);
  });

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
