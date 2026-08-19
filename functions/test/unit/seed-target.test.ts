import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
  allowedRemoteProjectId,
  parseSeedArguments,
  resolveSeedTarget,
} from "../../src/content/seed-target";

void describe("content seed target guard", () => {
  void it("defaults to the emulator and refuses to run without it", () => {
    assert.deepEqual(
      resolveSeedTarget(parseSeedArguments([]), "127.0.0.1:8080"),
      {mode: "emulator", projectId: allowedRemoteProjectId},
    );
    assert.throws(
      () => resolveSeedTarget(parseSeedArguments([]), undefined),
      /FIRESTORE_EMULATOR_HOST/u,
    );
  });

  void it("requires explicit remote confirmation", () => {
    assert.throws(
      () => resolveSeedTarget(
        parseSeedArguments(["--remote", "--project", allowedRemoteProjectId]),
        undefined,
      ),
      /confirm-remote-seed/u,
    );
  });

  void it("rejects every other remote project ID", () => {
    assert.throws(
      () => resolveSeedTarget(parseSeedArguments([
        "--remote",
        "--confirm-remote-seed",
        "--project",
        "pet-care-production-future",
      ]), undefined),
      /allowed only/u,
    );
  });

  void it("allows only the exact current MVP project with both flags", () => {
    assert.deepEqual(
      resolveSeedTarget(parseSeedArguments([
        "--remote",
        "--confirm-remote-seed",
        "--project",
        allowedRemoteProjectId,
      ]), undefined),
      {mode: "remote", projectId: allowedRemoteProjectId},
    );
  });
});
