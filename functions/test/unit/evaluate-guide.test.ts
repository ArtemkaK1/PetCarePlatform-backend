import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, it} from "node:test";

import {
  evaluateGuide,
  GuideEvaluationError,
  guideTargetsSpecies,
} from "../../src/guides/evaluate-guide";
import {parseGuideFixtures} from "../../src/guides/guide-fixture";
import type {
  GuideAnswer,
  GuideFixture,
} from "../../src/guides/guide";

const guides = parseGuideFixtures(JSON.parse(readFileSync(
  resolve(process.cwd(), "../seed/fixtures/guides.json"),
  "utf8",
)) as unknown);
const readinessGuide = guides.find(
  (guide) => guide.id === "demo-pet-home-readiness",
);
if (readinessGuide === undefined) {
  throw new Error("Readiness guide fixture is required for evaluation tests.");
}

function allAnswerCombinations(guide: GuideFixture): GuideAnswer[][] {
  return guide.questions.reduce<GuideAnswer[][]>(
    (combinations, question) => combinations.flatMap(
      (answers) => question.options.map((option) => [
        ...answers,
        {questionId: question.id, optionId: option.id},
      ]),
    ),
    [[]],
  );
}

void describe("guide evaluation", () => {
  void it("selects the same result regardless of answer input order", () => {
    const answers = [
      {questionId: "safe-space", optionId: "ready"},
      {questionId: "basic-supplies", optionId: "in-progress"},
      {questionId: "first-week-routine", optionId: "ready"},
    ];

    const forward = evaluateGuide(readinessGuide, answers);
    const reversed = evaluateGuide(readinessGuide, [...answers].reverse());

    assert.deepEqual(forward, reversed);
    assert.equal(forward.score, 5);
    assert.equal(forward.result.id, "ready-for-a-simple-start");
  });

  void it("rejects invalid question and option IDs", () => {
    assert.throws(
      () => evaluateGuide(readinessGuide, [
        {questionId: "not-a-question", optionId: "ready"},
      ]),
      (error: unknown) => error instanceof GuideEvaluationError &&
        error.code === "invalid_question_id",
    );
    assert.throws(
      () => evaluateGuide(readinessGuide, [
        {questionId: "safe-space", optionId: "not-an-option"},
      ]),
      (error: unknown) => error instanceof GuideEvaluationError &&
        error.code === "invalid_option_id",
    );
  });

  void it("requires exactly one answer for every question", () => {
    assert.throws(
      () => evaluateGuide(readinessGuide, [
        {questionId: "safe-space", optionId: "ready"},
        {questionId: "safe-space", optionId: "ready"},
      ]),
      (error: unknown) => error instanceof GuideEvaluationError &&
        error.code === "duplicate_question_id",
    );
    assert.throws(
      () => evaluateGuide(readinessGuide, [
        {questionId: "safe-space", optionId: "ready"},
      ]),
      (error: unknown) => error instanceof GuideEvaluationError &&
        error.code === "missing_answer",
    );
  });

  void it("applies guide species targeting", () => {
    const behaviourGuide = guides.find(
      (guide) => guide.id === "demo-behaviour-observation-check",
    );
    assert.ok(behaviourGuide !== undefined);
    assert.equal(guideTargetsSpecies(behaviourGuide, "dog"), true);
    assert.equal(guideTargetsSpecies(behaviourGuide, "cat"), true);
    assert.equal(guideTargetsSpecies(behaviourGuide, "other"), false);
    assert.equal(guideTargetsSpecies(readinessGuide, "other"), true);
  });

  for (const guide of guides) {
    void it(`exhaustively evaluates every path in ${guide.id}`, () => {
      const combinations = allAnswerCombinations(guide);
      const expectedPathCount = guide.questions.reduce(
        (count, question) => count * question.options.length,
        1,
      );
      assert.equal(combinations.length, expectedPathCount);

      const reachedResults = new Set<string>();
      for (const answers of combinations) {
        const forward = evaluateGuide(guide, answers);
        const reversed = evaluateGuide(guide, [...answers].reverse());
        assert.deepEqual(reversed, forward);

        const matchingResults = guide.results.filter(
          (result) => forward.score >= result.minScore &&
            forward.score <= result.maxScore,
        );
        assert.equal(matchingResults.length, 1);
        assert.equal(matchingResults[0]?.id, forward.result.id);
        reachedResults.add(forward.result.id);
      }

      assert.deepEqual(
        [...reachedResults].sort(),
        guide.results.map((result) => result.id).sort(),
      );
    });
  }
});
