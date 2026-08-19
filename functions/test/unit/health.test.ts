import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {createHealthResponse} from "../../src/health/health";

void describe("createHealthResponse", () => {
  void it("returns the backend health status", () => {
    assert.deepEqual(createHealthResponse(), {status: "ok"});
  });
});
