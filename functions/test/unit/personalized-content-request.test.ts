import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {HttpsError} from "firebase-functions/v2/https";

import {parsePersonalizedContentRequest} from "../../src/recommendations/get-personalized-content";

function isInvalidArgument(error: unknown): boolean {
  return error instanceof HttpsError && error.code === "invalid-argument";
}

void describe("parsePersonalizedContentRequest", () => {
  void it("uses the bounded default limit", () => {
    assert.deepEqual(parsePersonalizedContentRequest({petId: "pet-a"}), {
      petId: "pet-a",
      limit: 10,
    });
    assert.deepEqual(parsePersonalizedContentRequest({petId: "pet-a", limit: 20}), {
      petId: "pet-a",
      limit: 20,
    });
  });

  void it("rejects invalid and out-of-range limits", () => {
    for (const limit of [0, 21, 1.5, "10", null]) {
      assert.throws(
        () => parsePersonalizedContentRequest({petId: "pet-a", limit}),
        isInvalidArgument,
      );
    }
  });

  void it("rejects invalid IDs and unexpected fields", () => {
    assert.throws(
      () => parsePersonalizedContentRequest({petId: "pets/pet-a"}),
      isInvalidArgument,
    );
    assert.throws(
      () => parsePersonalizedContentRequest({
        petId: "pet-a",
        ownerId: "forged-owner",
      }),
      isInvalidArgument,
    );
  });
});
