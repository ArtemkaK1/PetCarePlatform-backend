import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {describe, it} from "node:test";

import {parseContentFixtures} from "../../src/content/content-fixture";

void describe("content fixture validation", () => {
  void it("parses and deterministically sorts the versioned fixtures", async () => {
    const fixturePath = resolve(process.cwd(), "../seed/fixtures/content.json");
    const source = await readFile(fixturePath, "utf8");
    const fixtures = parseContentFixtures(JSON.parse(source) as unknown);

    assert.equal(fixtures.length, 10);
    assert.deepEqual(
      fixtures.map((fixture) => fixture.id),
      [...fixtures.map((fixture) => fixture.id)].sort(),
    );
    assert.equal(
      fixtures.every((fixture) => fixture.title.startsWith("Demo")),
      true,
    );
  });

  void it("rejects invalid and unexpected fixture data", () => {
    assert.throws(
      () => parseContentFixtures([{
        id: "invalid-content",
        title: "Demo invalid fixture",
        shortDescription: "Invalid fixture",
        type: "video",
        topics: ["testing"],
        species: ["dog"],
        status: "published",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        unexpected: true,
      }]),
      /unexpected field/u,
    );
  });

  void it("requires type-specific content fields", () => {
    assert.throws(
      () => parseContentFixtures([{
        id: "video-without-url",
        title: "Demo video",
        shortDescription: "Missing URL",
        type: "video",
        topics: ["testing"],
        species: ["cat"],
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }]),
      /externalUrl is required/u,
    );
  });
});
