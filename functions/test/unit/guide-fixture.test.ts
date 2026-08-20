import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {describe, it} from "node:test";

import {parseGuideFixtures} from "../../src/guides/guide-fixture";

async function loadVersionedFixtures(): Promise<unknown> {
  const path = resolve(process.cwd(), "../seed/fixtures/guides.json");
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

void describe("guide fixture validation", () => {
  void it("parses and deterministically sorts the demo guides", async () => {
    const fixtures = parseGuideFixtures(await loadVersionedFixtures());

    assert.equal(fixtures.length, 3);
    assert.deepEqual(
      fixtures.map((fixture) => fixture.id),
      [...fixtures.map((fixture) => fixture.id)].sort(),
    );
    assert.equal(fixtures.every((fixture) => fixture.title.startsWith("Demo:")), true);
  });

  void it("rejects unknown fields and duplicate question IDs", async () => {
    const fixtures = await loadVersionedFixtures();
    assert.ok(Array.isArray(fixtures));
    const fixture = structuredClone(fixtures[0]) as Record<string, unknown>;
    fixture.unexpected = true;
    assert.throws(() => parseGuideFixtures([fixture]), /unexpected field/u);

    const duplicate = structuredClone(fixtures[0]) as Record<string, unknown>;
    const questions = duplicate.questions as Record<string, unknown>[];
    const firstQuestion = questions[0];
    assert.ok(firstQuestion !== undefined);
    questions[1] = structuredClone(firstQuestion);
    assert.throws(() => parseGuideFixtures([duplicate]), /question IDs must be unique/u);
  });

  void it("rejects result ranges with gaps", async () => {
    const fixtures = await loadVersionedFixtures();
    assert.ok(Array.isArray(fixtures));
    const fixture = structuredClone(fixtures[2]) as Record<string, unknown>;
    const results = fixture.results as Record<string, unknown>[];
    const secondResult = results[1];
    assert.ok(secondResult !== undefined);
    secondResult.minScore = 4;

    assert.throws(
      () => parseGuideFixtures([fixture]),
      /cover every possible score without gaps or overlaps/u,
    );
  });

  void it("rejects a continuous result range that no answers can reach", async () => {
    const fixtures = await loadVersionedFixtures();
    assert.ok(Array.isArray(fixtures));
    const fixture = structuredClone(fixtures[0]) as Record<string, unknown>;
    const questions = fixture.questions as Record<string, unknown>[];
    const routineQuestion = questions[1];
    assert.ok(routineQuestion !== undefined);
    const options = routineQuestion.options as Record<string, unknown>[];
    const sometimes = options[1];
    const frequently = options[2];
    assert.ok(sometimes !== undefined && frequently !== undefined);
    sometimes.score = 1;
    frequently.score = 2;

    const results = fixture.results as Record<string, unknown>[];
    const urgentResult = results[2];
    assert.ok(urgentResult !== undefined);
    urgentResult.maxScore = 8;

    assert.throws(
      () => parseGuideFixtures([fixture]),
      /result 'seek-routine-support' is unreachable/u,
    );
  });
});
