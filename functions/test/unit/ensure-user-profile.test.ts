import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {Timestamp} from "firebase-admin/firestore";
import type {CallableRequest} from "firebase-functions/v2/https";
import {HttpsError} from "firebase-functions/v2/https";

import {
  ensureProfile,
  getAuthenticatedIdentity,
} from "../../src/users/ensure-user-profile";
import type {UserProfileRepository} from "../../src/users/user-profile-repository";

type CallableAuth = NonNullable<CallableRequest<unknown>["auth"]>;

function authentication(uid: string, email?: string): CallableAuth {
  return {
    uid,
    token: {email} as CallableAuth["token"],
    rawToken: "emulator-token",
  };
}

void describe("getAuthenticatedIdentity", () => {
  void it("rejects unauthenticated requests", () => {
    assert.throws(
      () => getAuthenticatedIdentity({auth: undefined}),
      (error: unknown) => error instanceof HttpsError &&
        error.code === "unauthenticated",
    );
  });

  void it("uses only the authenticated uid and email", () => {
    const identity = getAuthenticatedIdentity({
      auth: authentication("user-a", "user-a@example.com"),
    });

    assert.deepEqual(identity, {
      uid: "user-a",
      email: "user-a@example.com",
    });
  });

  void it("rejects authenticated accounts without an email", () => {
    assert.throws(
      () => getAuthenticatedIdentity({
        auth: authentication("user-a"),
      }),
      (error: unknown) => error instanceof HttpsError &&
        error.code === "failed-precondition",
    );
  });
});

void describe("ensureProfile", () => {
  void it("delegates profile persistence using authenticated identity", async () => {
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);
    const repository: UserProfileRepository = {
      ensure(identity) {
        return Promise.resolve({
          ...identity,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      },
    };

    const profile = await ensureProfile(
      {uid: "user-a", email: "user-a@example.com"},
      repository,
    );

    assert.equal(profile.uid, "user-a");
    assert.equal(profile.email, "user-a@example.com");
    assert.equal(profile.createdAt, timestamp);
    assert.equal(profile.updatedAt, timestamp);
  });
});
