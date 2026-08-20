import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  calculateNextDueAt,
  MAX_RECURRENCE_INTERVAL,
} from "../../src/care-plan/calculate-next-due-at";

void describe("calculateNextDueAt", () => {
  void it("calculates daily and weekly intervals in UTC", () => {
    const current = new Date("2026-03-28T10:15:30.000Z");

    assert.equal(
      calculateNextDueAt(current, {frequency: "daily", interval: 2}).toISOString(),
      "2026-03-30T10:15:30.000Z",
    );
    assert.equal(
      calculateNextDueAt(current, {frequency: "weekly", interval: 3}).toISOString(),
      "2026-04-18T10:15:30.000Z",
    );
    assert.equal(current.toISOString(), "2026-03-28T10:15:30.000Z");
  });

  void it("clamps monthly recurrence to the target month's final day", () => {
    assert.equal(
      calculateNextDueAt(
        new Date("2026-01-31T08:00:00.000Z"),
        {frequency: "monthly", interval: 1},
      ).toISOString(),
      "2026-02-28T08:00:00.000Z",
    );
    assert.equal(
      calculateNextDueAt(
        new Date("2024-01-31T08:00:00.000Z"),
        {frequency: "monthly", interval: 1},
      ).toISOString(),
      "2024-02-29T08:00:00.000Z",
    );
    assert.equal(
      calculateNextDueAt(
        new Date("2026-01-31T08:00:00.000Z"),
        {frequency: "monthly", interval: 2},
      ).toISOString(),
      "2026-03-31T08:00:00.000Z",
    );
  });

  void it("is deterministic for the same due date and recurrence", () => {
    const current = new Date("2026-10-31T23:45:00.000Z");
    const recurrence = {frequency: "monthly" as const, interval: 1};

    assert.deepEqual(
      calculateNextDueAt(current, recurrence),
      calculateNextDueAt(current, recurrence),
    );
  });

  void it("rejects invalid dates and unsupported intervals", () => {
    assert.throws(
      () => calculateNextDueAt(
        new Date("invalid"),
        {frequency: "daily", interval: 1},
      ),
      /due date must be valid/u,
    );
    for (const interval of [0, 1.5, MAX_RECURRENCE_INTERVAL + 1]) {
      assert.throws(
        () => calculateNextDueAt(
          new Date("2026-01-01T00:00:00.000Z"),
          {frequency: "weekly", interval},
        ),
        /interval from 1 to 12/u,
      );
    }
  });
});
