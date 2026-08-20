import type {
  GuideAnswerOption,
  GuideFixture,
  GuideQuestion,
  GuideResult,
  GuideStatus,
  GuideUrgency,
} from "./guide";
import type {ContentSpecies} from "../content/content";

const guideKeys = new Set([
  "ageGroups", "createdAt", "description", "id", "questions", "results",
  "species", "status", "title", "topics", "updatedAt",
]);
const questionKeys = new Set(["id", "options", "prompt"]);
const optionKeys = new Set(["id", "label", "score"]);
const resultKeys = new Set([
  "id", "maxScore", "minScore", "recommendedContentIds",
  "suggestClinicRouting", "text", "title", "topics", "urgency",
]);
const statuses = new Set<GuideStatus>(["draft", "published"]);
const speciesValues = new Set<ContentSpecies>(["dog", "cat", "other"]);
const urgencies = new Set<GuideUrgency>([
  "informational", "consider_professional_help", "urgent_external_help",
]);

function assertRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  keys: Set<string>,
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) {
      throw new Error(`${path} contains unexpected field '${key}'.`);
    }
  }
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const field = value[key];
  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(`${path}.${key} must be a nonempty string.`);
  }
  return field;
}

function identifier(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const field = requiredString(value, key, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(field)) {
    throw new Error(`${path}.${key} must be a lowercase kebab-case identifier.`);
  }
  return field;
}

function integer(
  value: Record<string, unknown>,
  key: string,
  path: string,
): number {
  const field = value[key];
  if (typeof field !== "number" || !Number.isInteger(field)) {
    throw new Error(`${path}.${key} must be an integer.`);
  }
  return field;
}

function stringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  required: boolean,
): string[] | undefined {
  const field = value[key];
  if (field === undefined && !required) return undefined;
  if (!Array.isArray(field) || field.length === 0 ||
      !field.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`${path}.${key} must be a nonempty string array.`);
  }
  const items = field as string[];
  if (new Set(items).size !== items.length) {
    throw new Error(`${path}.${key} must not contain duplicates.`);
  }
  return items;
}

function timestampString(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const field = requiredString(value, key, path);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(field) ||
      !Number.isFinite(Date.parse(field))) {
    throw new Error(`${path}.${key} must be an ISO-8601 UTC timestamp.`);
  }
  return field;
}

function parseOptions(value: unknown, path: string): GuideAnswerOption[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`${path} must contain at least two answer options.`);
  }
  const options = value.map((item, index) => {
    const optionPath = `${path}[${String(index)}]`;
    assertRecord(item, optionPath);
    assertOnlyKeys(item, optionKeys, optionPath);
    return {
      id: identifier(item, "id", optionPath),
      label: requiredString(item, "label", optionPath),
      score: integer(item, "score", optionPath),
    };
  });
  if (new Set(options.map((option) => option.id)).size !== options.length) {
    throw new Error(`${path} option IDs must be unique.`);
  }
  return options;
}

function parseQuestions(value: unknown, path: string): GuideQuestion[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a nonempty array.`);
  }
  const questions = value.map((item, index) => {
    const questionPath = `${path}[${String(index)}]`;
    assertRecord(item, questionPath);
    assertOnlyKeys(item, questionKeys, questionPath);
    return {
      id: identifier(item, "id", questionPath),
      prompt: requiredString(item, "prompt", questionPath),
      options: parseOptions(item.options, `${questionPath}.options`),
    };
  });
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    throw new Error(`${path} question IDs must be unique.`);
  }
  return questions;
}

function parseResults(value: unknown, path: string): GuideResult[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a nonempty array.`);
  }
  const results = value.map((item, index) => {
    const resultPath = `${path}[${String(index)}]`;
    assertRecord(item, resultPath);
    assertOnlyKeys(item, resultKeys, resultPath);
    const urgency = requiredString(item, "urgency", resultPath) as GuideUrgency;
    if (!urgencies.has(urgency)) {
      throw new Error(`${resultPath}.urgency is invalid.`);
    }
    const minScore = integer(item, "minScore", resultPath);
    const maxScore = integer(item, "maxScore", resultPath);
    if (minScore > maxScore) {
      throw new Error(`${resultPath} has an invalid score range.`);
    }
    const routing = item.suggestClinicRouting;
    if (routing !== undefined && typeof routing !== "boolean") {
      throw new Error(`${resultPath}.suggestClinicRouting must be a boolean.`);
    }
    const recommendedContentIds = stringArray(
      item, "recommendedContentIds", resultPath, false,
    );
    const topics = stringArray(item, "topics", resultPath, false);
    return {
      id: identifier(item, "id", resultPath),
      title: requiredString(item, "title", resultPath),
      text: requiredString(item, "text", resultPath),
      urgency,
      minScore,
      maxScore,
      ...(recommendedContentIds === undefined ? {} : {recommendedContentIds}),
      ...(topics === undefined ? {} : {topics}),
      ...(routing === undefined ? {} : {suggestClinicRouting: routing}),
    };
  });
  if (new Set(results.map((result) => result.id)).size !== results.length) {
    throw new Error(`${path} result IDs must be unique.`);
  }
  return results;
}

function validateScoreCoverage(
  questions: GuideQuestion[],
  results: GuideResult[],
  path: string,
): void {
  const minimum = questions.reduce(
    (sum, question) => sum + Math.min(...question.options.map((item) => item.score)), 0,
  );
  const maximum = questions.reduce(
    (sum, question) => sum + Math.max(...question.options.map((item) => item.score)), 0,
  );
  const ordered = [...results].sort((left, right) => left.minScore - right.minScore);
  if (ordered[0]?.minScore !== minimum ||
      ordered.at(-1)?.maxScore !== maximum ||
      ordered.some((result, index) => index > 0 &&
        result.minScore !== (ordered[index - 1]?.maxScore ?? 0) + 1)) {
    throw new Error(`${path}.results must cover every possible score without gaps or overlaps.`);
  }

  let reachableScores = new Set([0]);
  for (const question of questions) {
    const nextScores = new Set<number>();
    for (const currentScore of reachableScores) {
      for (const option of question.options) {
        nextScores.add(currentScore + option.score);
      }
    }
    reachableScores = nextScores;
  }

  for (const result of results) {
    const isReachable = [...reachableScores].some(
      (score) => score >= result.minScore && score <= result.maxScore,
    );
    if (!isReachable) {
      throw new Error(
        `${path}.results result '${result.id}' is unreachable by any complete answer combination.`,
      );
    }
  }
}

function validateFixture(value: unknown, index: number): GuideFixture {
  const path = `guides[${String(index)}]`;
  assertRecord(value, path);
  assertOnlyKeys(value, guideKeys, path);
  const status = requiredString(value, "status", path) as GuideStatus;
  if (!statuses.has(status)) throw new Error(`${path}.status is invalid.`);
  const rawSpecies = stringArray(value, "species", path, true) ?? [];
  if (!rawSpecies.every((item) => speciesValues.has(item as ContentSpecies))) {
    throw new Error(`${path}.species contains an invalid value.`);
  }
  const questions = parseQuestions(value.questions, `${path}.questions`);
  const results = parseResults(value.results, `${path}.results`);
  validateScoreCoverage(questions, results, path);
  const createdAt = timestampString(value, "createdAt", path);
  const updatedAt = timestampString(value, "updatedAt", path);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Error(`${path}.updatedAt cannot precede createdAt.`);
  }
  const ageGroups = stringArray(value, "ageGroups", path, false);
  const topics = stringArray(value, "topics", path, false);
  return {
    id: identifier(value, "id", path),
    title: requiredString(value, "title", path),
    description: requiredString(value, "description", path),
    species: rawSpecies as ContentSpecies[],
    questions,
    results,
    status,
    createdAt,
    updatedAt,
    ...(ageGroups === undefined ? {} : {ageGroups}),
    ...(topics === undefined ? {} : {topics}),
  };
}

export function parseGuideFixtures(value: unknown): GuideFixture[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Guide fixtures must be a nonempty array.");
  }
  const fixtures = value.map(validateFixture);
  if (new Set(fixtures.map((fixture) => fixture.id)).size !== fixtures.length) {
    throw new Error("Guide fixture IDs must be unique.");
  }
  return fixtures.sort((left, right) => left.id.localeCompare(right.id));
}
