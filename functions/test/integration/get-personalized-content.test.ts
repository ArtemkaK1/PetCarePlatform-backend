import assert from "node:assert/strict";
import {after, before, describe, it} from "node:test";

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {deleteApp, initializeApp, type FirebaseApp} from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import {doc, setDoc, Timestamp} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  type HttpsCallable,
  httpsCallable,
} from "firebase/functions";

interface RecommendationItem {
  contentId: string;
  reasons: string[];
  score: number;
}

interface RecommendationResponse {
  items: RecommendationItem[];
  petId: string;
}

const projectId = "volrik-pet-care-platform";
const password = "emulator-password";
let environment: RulesTestEnvironment;
let ownerApp: FirebaseApp;
let otherUserApp: FirebaseApp;
let unauthenticatedApp: FirebaseApp;
let petId: string;

function emulatorAddress(): {host: string; port: number} {
  const address = process.env.FIRESTORE_EMULATOR_HOST;
  if (address === undefined) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required.");
  }
  const separator = address.lastIndexOf(":");
  return {
    host: address.slice(0, separator),
    port: Number(address.slice(separator + 1)),
  };
}

function createClientApp(name: string): FirebaseApp {
  const app = initializeApp({
    projectId,
    apiKey: "emulator-only",
    authDomain: `${projectId}.firebaseapp.com`,
  }, name);
  connectAuthEmulator(getAuth(app), "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFunctionsEmulator(
    getFunctions(app, "europe-west1"),
    "127.0.0.1",
    5001,
  );
  return app;
}

function callable(app: FirebaseApp): HttpsCallable<
  {limit?: number; petId: string},
  RecommendationResponse
> {
  return httpsCallable<{limit?: number; petId: string}, RecommendationResponse>(
    getFunctions(app, "europe-west1"),
    "getPersonalizedContent",
  );
}

function hasFunctionsCode(code: string): (error: unknown) => boolean {
  return (error: unknown) => error instanceof Error &&
    "code" in error && error.code === code;
}

void describe("getPersonalizedContent callable", () => {
  before(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: emulatorAddress(),
    });
    await environment.clearFirestore();

    const suffix = String(Date.now());
    ownerApp = createClientApp(`recommendation-owner-${suffix}`);
    otherUserApp = createClientApp(`recommendation-other-${suffix}`);
    unauthenticatedApp = createClientApp(`recommendation-unauthenticated-${suffix}`);

    const ownerCredential = await createUserWithEmailAndPassword(
      getAuth(ownerApp),
      `recommendation-owner-${suffix}@example.com`,
      password,
    );
    await createUserWithEmailAndPassword(
      getAuth(otherUserApp),
      `recommendation-other-${suffix}@example.com`,
      password,
    );
    petId = "recommendation-pet";

    await environment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore();
      const timestamp = Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z"));
      await setDoc(doc(database, "pets", petId), {
        ownerId: ownerCredential.user.uid,
        name: "Milo",
        species: "dog",
        sex: "male",
        breed: "labrador-retriever",
        countryCode: "GB",
        birthDate: Timestamp.fromDate(new Date("2022-01-01T00:00:00.000Z")),
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const baseContent = {
        title: "Demo recommendation content",
        shortDescription: "Integration fixture",
        type: "article",
        topics: ["testing"],
        body: "Demo fixture body.",
        status: "published",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await setDoc(doc(database, "content", "dog-all-matches"), {
        ...baseContent,
        species: ["dog"],
        breeds: ["labrador-retriever"],
        ageGroups: ["adult"],
        countryCodes: ["GB"],
      });
      await setDoc(doc(database, "content", "dog-generic"), {
        ...baseContent,
        species: ["dog"],
      });
      await setDoc(doc(database, "content", "cat-incompatible"), {
        ...baseContent,
        species: ["cat"],
      });
      await setDoc(doc(database, "content", "dog-draft"), {
        ...baseContent,
        species: ["dog"],
        status: "draft",
        breeds: ["labrador-retriever"],
        ageGroups: ["adult"],
        countryCodes: ["GB"],
      });
    });
  });

  after(async () => {
    await Promise.all([
      deleteApp(ownerApp),
      deleteApp(otherUserApp),
      deleteApp(unauthenticatedApp),
    ]);
    await environment.cleanup();
  });

  void it("rejects unauthenticated calls", async () => {
    await assert.rejects(
      callable(unauthenticatedApp)({petId}),
      hasFunctionsCode("functions/unauthenticated"),
    );
  });

  void it("rejects recommendations for another user's pet", async () => {
    await assert.rejects(
      callable(otherUserApp)({petId}),
      hasFunctionsCode("functions/permission-denied"),
    );
  });

  void it("returns only compatible published content in deterministic order", async () => {
    const first = await callable(ownerApp)({petId});
    const second = await callable(ownerApp)({petId});

    assert.deepEqual(first.data, second.data);
    assert.deepEqual(
      first.data.items.map((item) => item.contentId),
      ["dog-all-matches", "dog-generic"],
    );
    assert.deepEqual(first.data.items[0], {
      ...first.data.items[0],
      contentId: "dog-all-matches",
      score: 160,
      reasons: [
        "species_match",
        "breed_match",
        "age_match",
        "country_match",
      ],
    });
  });

  void it("validates and bounds limit", async () => {
    await assert.rejects(
      callable(ownerApp)({petId, limit: 0}),
      hasFunctionsCode("functions/invalid-argument"),
    );
    await assert.rejects(
      callable(ownerApp)({petId, limit: 21}),
      hasFunctionsCode("functions/invalid-argument"),
    );
    const response = await callable(ownerApp)({petId, limit: 1});
    assert.equal(response.data.items.length, 1);
  });
});
