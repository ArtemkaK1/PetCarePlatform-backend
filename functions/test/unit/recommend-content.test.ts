import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  derivePetAgeGroup,
  recommendContent,
  type RecommendableContent,
} from "../../src/recommendations/recommend-content";

function content(
  id: string,
  overrides: Partial<RecommendableContent> = {},
): RecommendableContent {
  return {id, species: ["dog"], ...overrides};
}

void describe("recommendContent", () => {
  void it("excludes content incompatible with the pet species", () => {
    const recommendations = recommendContent(
      {species: "dog"},
      [content("dog-content"), content("cat-content", {species: ["cat"]})],
      10,
    );

    assert.deepEqual(
      recommendations.map((item) => item.content.id),
      ["dog-content"],
    );
  });

  void it("orders breed, age, and country matches by fixed score", () => {
    const recommendations = recommendContent({
      species: "dog",
      breed: "Labrador-Retriever",
      ageGroup: "adult",
      countryCode: "gb",
    }, [
      content("generic"),
      content("country", {countryCodes: ["GB"]}),
      content("age", {ageGroups: ["adult"]}),
      content("breed", {breeds: ["labrador-retriever"]}),
      content("all", {
        breeds: ["labrador-retriever"],
        ageGroups: ["adult"],
        countryCodes: ["GB"],
      }),
    ], 10);

    assert.deepEqual(
      recommendations.map(({content: item, score}) => [item.id, score]),
      [
        ["all", 160],
        ["breed", 130],
        ["age", 120],
        ["country", 110],
        ["generic", 100],
      ],
    );
    assert.deepEqual(recommendations[0]?.reasons, [
      "species_match",
      "breed_match",
      "age_match",
      "country_match",
    ]);
  });

  void it("uses content ID as a deterministic tie-breaker and applies limit", () => {
    const input = [content("z-last"), content("a-first"), content("m-middle")];
    const first = recommendContent({species: "dog"}, input, 2);
    const second = recommendContent({species: "dog"}, [...input].reverse(), 2);

    assert.deepEqual(first, second);
    assert.deepEqual(
      first.map((item) => item.content.id),
      ["a-first", "m-middle"],
    );
  });
});

void describe("derivePetAgeGroup", () => {
  const asOf = new Date("2026-08-19T12:00:00.000Z");

  void it("derives species-aware juvenile and stable adult/senior groups", () => {
    assert.equal(
      derivePetAgeGroup("dog", new Date("2026-01-01T00:00:00.000Z"), asOf),
      "puppy",
    );
    assert.equal(
      derivePetAgeGroup("cat", new Date("2026-01-01T00:00:00.000Z"), asOf),
      "kitten",
    );
    assert.equal(
      derivePetAgeGroup("dog", new Date("2022-01-01T00:00:00.000Z"), asOf),
      "adult",
    );
    assert.equal(
      derivePetAgeGroup("cat", new Date("2015-01-01T00:00:00.000Z"), asOf),
      "senior",
    );
  });

  void it("does not derive an age group from a future birth date", () => {
    assert.equal(
      derivePetAgeGroup("dog", new Date("2027-01-01T00:00:00.000Z"), asOf),
      undefined,
    );
  });
});
