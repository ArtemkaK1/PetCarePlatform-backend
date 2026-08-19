import assert from "node:assert/strict";
import {after, before, describe, it} from "node:test";

import {deleteApp, initializeApp, type FirebaseApp} from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  Timestamp,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

interface UserProfileResponse {
  createdAt: string;
  email: string;
  uid: string;
  updatedAt: string;
}

const projectId = "volrik-pet-care-platform";
let app: FirebaseApp;

void describe("ensureUserProfile callable", () => {
  before(async () => {
    app = initializeApp({
      projectId,
      apiKey: "emulator-only",
      authDomain: `${projectId}.firebaseapp.com`,
    }, `ensure-user-profile-${String(Date.now())}`);

    const auth = getAuth(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8080);
    connectFunctionsEmulator(
      getFunctions(app, "europe-west1"),
      "127.0.0.1",
      5001,
    );

    await createUserWithEmailAndPassword(
      auth,
      `profile-${String(Date.now())}@example.com`,
      "emulator-password",
    );
  });

  after(async () => {
    await deleteApp(app);
  });

  void it("rejects unauthenticated calls", async () => {
    const unauthenticatedApp = initializeApp({
      projectId,
      apiKey: "emulator-only",
      authDomain: `${projectId}.firebaseapp.com`,
    }, `ensure-user-profile-unauthenticated-${String(Date.now())}`);
    const functions = getFunctions(unauthenticatedApp, "europe-west1");
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);

    try {
      const callable = httpsCallable(functions, "ensureUserProfile");
      await assert.rejects(
        callable(),
        (error: unknown) => error instanceof Error &&
          "code" in error &&
          error.code === "functions/unauthenticated",
      );
    } finally {
      await deleteApp(unauthenticatedApp);
    }
  });

  void it("creates once from auth identity and returns the existing profile", async () => {
    const auth = getAuth(app);
    const currentUser = auth.currentUser;
    if (currentUser === null) {
      throw new Error("Expected an authenticated emulator user.");
    }

    const callable = httpsCallable<unknown, UserProfileResponse>(
      getFunctions(app, "europe-west1"),
      "ensureUserProfile",
    );
    const first = await callable({
      uid: "forged-client-uid",
      email: "forged@example.com",
    });

    assert.equal(first.data.uid, currentUser.uid);
    assert.equal(first.data.email, currentUser.email);

    const profileSnapshot = await getDoc(
      doc(getFirestore(app), "users", currentUser.uid),
    );
    assert.equal(profileSnapshot.exists(), true);
    assert.equal(profileSnapshot.data()?.uid, currentUser.uid);
    assert.equal(profileSnapshot.data()?.email, currentUser.email);
    assert.equal(profileSnapshot.data()?.createdAt instanceof Timestamp, true);
    assert.equal(profileSnapshot.data()?.updatedAt instanceof Timestamp, true);

    const second = await callable({email: "another-forged@example.com"});
    assert.deepEqual(second.data, first.data);
  });
});
