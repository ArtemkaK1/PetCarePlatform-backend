import assert from "node:assert/strict";
import {after, before, beforeEach, describe, it} from "node:test";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

const projectId = "volrik-pet-care-platform";
const userA = "user-a";
const userB = "user-b";
const petId = "pet-a";

let testEnvironment: RulesTestEnvironment;

function emulatorAddress(): {host: string; port: number} {
  const address = process.env.FIRESTORE_EMULATOR_HOST;
  if (address === undefined) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required for rules tests.");
  }

  const separator = address.lastIndexOf(":");
  if (separator < 1) {
    throw new Error(`Invalid FIRESTORE_EMULATOR_HOST: ${address}`);
  }

  return {
    host: address.slice(0, separator),
    port: Number(address.slice(separator + 1)),
  };
}

function validPet(ownerId: string): Record<string, unknown> {
  return {
    ownerId,
    name: "Milo",
    species: "dog",
    sex: "male",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function seedPet(ownerId = userA): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);
    await setDoc(doc(context.firestore(), "pets", petId), {
      ownerId,
      name: "Milo",
      species: "dog",
      sex: "male",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

async function seedUser(uid: string): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);
    await setDoc(doc(context.firestore(), "users", uid), {
      uid,
      email: `${uid}@example.com`,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

void describe("Firestore ownership rules", () => {
  before(async () => {
    const rules = await readFile(
      resolve(process.cwd(), "../firestore.rules"),
      "utf8",
    );
    testEnvironment = await initializeTestEnvironment({
      projectId,
      firestore: {...emulatorAddress(), rules},
    });
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
  });

  after(async () => {
    await testEnvironment.cleanup();
  });

  void it("1. unauthenticated user cannot read pets", async () => {
    await seedPet();
    const database = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, "pets", petId)));
  });

  void it("2. user A can create own pet", async () => {
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(setDoc(doc(database, "pets", petId), validPet(userA)));
  });

  void it("3. user A cannot create pet for user B", async () => {
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertFails(setDoc(doc(database, "pets", petId), validPet(userB)));
  });

  void it("4. user A can read own pet", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(getDoc(doc(database, "pets", petId)));
  });

  void it("5. user B cannot read user A pet", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userB).firestore();
    await assertFails(getDoc(doc(database, "pets", petId)));
  });

  void it("6. user A can update own pet", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(updateDoc(doc(database, "pets", petId), {
      name: "Milo II",
      updatedAt: serverTimestamp(),
    }));
  });

  void it("7. ownerId cannot be changed", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertFails(updateDoc(doc(database, "pets", petId), {
      ownerId: userB,
      updatedAt: serverTimestamp(),
    }));
  });

  void it("8. user B cannot update user A pet", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userB).firestore();
    await assertFails(updateDoc(doc(database, "pets", petId), {
      name: "Stolen name",
      updatedAt: serverTimestamp(),
    }));
  });

  void it("9. user A can delete own pet", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(deleteDoc(doc(database, "pets", petId)));
  });

  void it("10. user B cannot delete user A pet", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userB).firestore();
    await assertFails(deleteDoc(doc(database, "pets", petId)));
  });

  void it("11. user A can read own user profile", async () => {
    await seedUser(userA);
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(getDoc(doc(database, "users", userA)));
  });

  void it("12. user B cannot read user A profile", async () => {
    await seedUser(userA);
    const database = testEnvironment.authenticatedContext(userB).firestore();
    await assertFails(getDoc(doc(database, "users", userA)));
  });

  void it("rejects unexpected pet fields", async () => {
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertFails(setDoc(doc(database, "pets", petId), {
      ...validPet(userA),
      notes: "not part of the MVP schema",
    }));
  });

  void it("rejects unauthenticated user profile access", async () => {
    await seedUser(userA);
    const database = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, "users", userA)));
  });

  void it("rejects client writes to user profiles", async () => {
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertFails(setDoc(doc(database, "users", userA), {
      uid: userA,
      email: "user-a@example.com",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  });

  void it("stores optional birthDate when it is a timestamp", async () => {
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(setDoc(doc(database, "pets", petId), {
      ...validPet(userA),
      birthDate: Timestamp.fromMillis(1_600_000_000_000),
    }));

    const snapshot = await getDoc(doc(database, "pets", petId));
    assert.equal(snapshot.data()?.ownerId, userA);
  });
});
