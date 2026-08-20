import type {ContentSpecies} from "../content/content";
import type {
  GuideAnswer,
  GuideEvaluation,
  GuideFields,
} from "./guide";

export type GuideEvaluationErrorCode =
  | "duplicate_question_id"
  | "invalid_option_id"
  | "invalid_question_id"
  | "missing_answer"
  | "unmatched_score";

export class GuideEvaluationError extends Error {
  constructor(readonly code: GuideEvaluationErrorCode, message: string) {
    super(message);
    this.name = "GuideEvaluationError";
  }
}

export function guideTargetsSpecies(
  guide: Pick<GuideFields, "species">,
  species: ContentSpecies,
): boolean {
  return guide.species.includes(species);
}

export function evaluateGuide(
  guide: Pick<GuideFields, "questions" | "results">,
  answers: GuideAnswer[],
): GuideEvaluation {
  const questions = new Map(
    guide.questions.map((question) => [question.id, question]),
  );
  const selectedOptions = new Map<string, string>();

  for (const answer of answers) {
    const question = questions.get(answer.questionId);
    if (question === undefined) {
      throw new GuideEvaluationError(
        "invalid_question_id",
        `Unknown question ID '${answer.questionId}'.`,
      );
    }
    if (selectedOptions.has(answer.questionId)) {
      throw new GuideEvaluationError(
        "duplicate_question_id",
        `Question '${answer.questionId}' was answered more than once.`,
      );
    }
    if (!question.options.some((option) => option.id === answer.optionId)) {
      throw new GuideEvaluationError(
        "invalid_option_id",
        `Unknown option ID '${answer.optionId}' for question '${answer.questionId}'.`,
      );
    }
    selectedOptions.set(answer.questionId, answer.optionId);
  }

  const unansweredQuestion = guide.questions.find(
    (question) => !selectedOptions.has(question.id),
  );
  if (unansweredQuestion !== undefined) {
    throw new GuideEvaluationError(
      "missing_answer",
      `Question '${unansweredQuestion.id}' requires an answer.`,
    );
  }

  const score = guide.questions.reduce((total, question) => {
    const selectedOption = selectedOptions.get(question.id);
    const option = question.options.find((item) => item.id === selectedOption);
    return total + (option?.score ?? 0);
  }, 0);
  const result = guide.results.find(
    (item) => score >= item.minScore && score <= item.maxScore,
  );
  if (result === undefined) {
    throw new GuideEvaluationError(
      "unmatched_score",
      `No guide result is defined for score ${String(score)}.`,
    );
  }

  return {score, result};
}
