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
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
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

async function seedPetDocument(id: string, ownerId: string): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);
    await setDoc(doc(context.firestore(), "pets", id), {
      ownerId,
      name: "Milo",
      species: "dog",
      sex: "male",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

async function seedPet(ownerId = userA): Promise<void> {
  await seedPetDocument(petId, ownerId);
}

function validCareTask(
  ownerId: string,
  referencedPetId = petId,
): Record<string, unknown> {
  return {
    ownerId,
    petId: referencedPetId,
    title: "Evening meal",
    category: "feeding",
    dueAt: Timestamp.fromMillis(1_800_000_000_000),
    status: "active",
    source: "user",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function seedCareTask(
  id: string,
  ownerId = userA,
  referencedPetId = petId,
): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);
    await setDoc(doc(context.firestore(), "careTasks", id), {
      ownerId,
      petId: referencedPetId,
      title: "Evening meal",
      category: "feeding",
      dueAt: Timestamp.fromMillis(1_800_000_000_000),
      status: "active",
      source: "user",
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

async function seedContent(
  id: string,
  status: "draft" | "published",
): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);
    await setDoc(doc(context.firestore(), "content", id), {
      title: `Demo ${status} content`,
      shortDescription: "Rules test fixture",
      type: "article",
      topics: ["testing"],
      species: ["dog"],
      body: "Demo fixture body.",
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

async function seedGuide(
  id: string,
  status: "draft" | "published",
): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);
    await setDoc(doc(context.firestore(), "guides", id), {
      id,
      title: `Demo: ${status} guide`,
      description: "Rules test fixture",
      species: ["dog"],
      questions: [{
        id: "ready",
        prompt: "Ready?",
        options: [
          {id: "no", label: "No", score: 0},
          {id: "yes", label: "Yes", score: 1},
        ],
      }],
      results: [{
        id: "result",
        minScore: 0,
        maxScore: 1,
        title: "Demo result",
        text: "Demo explanatory text.",
        urgency: "informational",
      }],
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

async function seedClinic(
  id: string,
  status: "hidden" | "published",
  countryCode = "GB",
  city = "Demo City",
  tags = ["general-care"],
): Promise<void> {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);
    await setDoc(doc(context.firestore(), "clinics", id), {
      name: `Demo Clinic: ${id}`,
      countryCode,
      city,
      address: "1 Example Street (demo only)",
      tags,
      services: ["routine-consultations"],
      status,
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

  void it("user can create, list, read, update, and delete an own care task", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const task = doc(database, "careTasks", "task-a");

    await assertSucceeds(setDoc(task, validCareTask(userA)));
    const created = await assertSucceeds(getDoc(task));
    assert.equal(created.data()?.ownerId, userA);

    const ownTasks = query(
      collection(database, "careTasks"),
      where("ownerId", "==", userA),
    );
    const taskList = await assertSucceeds(getDocs(ownTasks));
    assert.deepEqual(taskList.docs.map((item) => item.id), ["task-a"]);

    await assertSucceeds(updateDoc(task, {
      note: "Use the regular portion",
      status: "completed",
      updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(deleteDoc(task));
  });

  void it("cross-user care-task access fails", async () => {
    await seedPet();
    await seedCareTask("task-a");
    const database = testEnvironment.authenticatedContext(userB).firestore();
    const task = doc(database, "careTasks", "task-a");

    await assertFails(getDoc(task));
    await assertFails(updateDoc(task, {
      title: "Changed by another user",
      updatedAt: serverTimestamp(),
    }));
    await assertFails(deleteDoc(task));
  });

  void it("unauthenticated care-task access fails", async () => {
    await seedPet();
    await seedCareTask("task-a");
    const database = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(database, "careTasks", "task-a")));
  });

  void it("care task cannot reference another user's pet", async () => {
    await seedPetDocument("pet-b", userB);
    const database = testEnvironment.authenticatedContext(userA).firestore();

    await assertFails(setDoc(
      doc(database, "careTasks", "task-a"),
      validCareTask(userA, "pet-b"),
    ));
  });

  void it("care-task ownership fields cannot be reassigned", async () => {
    await seedPet();
    await seedPetDocument("pet-a-second", userA);
    await seedCareTask("task-a");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const task = doc(database, "careTasks", "task-a");

    await assertFails(updateDoc(task, {
      ownerId: userB,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(task, {
      petId: "pet-a-second",
      updatedAt: serverTimestamp(),
    }));
  });

  void it("accepts supported recurrence and rejects invalid task schemas", async () => {
    await seedPet();
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const recurringTask = {
      ...validCareTask(userA),
      dueAt: undefined,
      nextDueAt: Timestamp.fromMillis(1_800_000_000_000),
      recurrence: {frequency: "weekly", interval: 2},
    };
    delete recurringTask.dueAt;

    await assertSucceeds(setDoc(
      doc(database, "careTasks", "recurring-task"),
      recurringTask,
    ));
    await assertFails(setDoc(doc(database, "careTasks", "bad-recurrence"), {
      ...recurringTask,
      recurrence: {frequency: "yearly", interval: 1},
    }));
    await assertFails(setDoc(doc(database, "careTasks", "unknown-field"), {
      ...validCareTask(userA),
      notificationEnabled: true,
    }));
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

  void it("stores optional pet recommendation metadata", async () => {
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(setDoc(doc(database, "pets", petId), {
      ...validPet(userA),
      breed: "labrador-retriever",
      countryCode: "GB",
    }));

    const snapshot = await getDoc(doc(database, "pets", petId));
    assert.equal(snapshot.data()?.breed, "labrador-retriever");
    assert.equal(snapshot.data()?.countryCode, "GB");
  });

  void it("authenticated user can read published content", async () => {
    await seedContent("published-content", "published");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(getDoc(doc(database, "content", "published-content")));
  });

  void it("unauthenticated user cannot read published content", async () => {
    await seedContent("published-content", "published");
    const database = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, "content", "published-content")));
  });

  void it("authenticated user cannot directly read draft content", async () => {
    await seedContent("draft-content", "draft");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertFails(getDoc(doc(database, "content", "draft-content")));
  });

  void it("published-content query excludes drafts", async () => {
    await seedContent("published-content", "published");
    await seedContent("draft-content", "draft");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const publishedQuery = query(
      collection(database, "content"),
      where("status", "==", "published"),
    );
    const snapshot = await assertSucceeds(getDocs(publishedQuery));

    assert.deepEqual(snapshot.docs.map((item) => item.id), ["published-content"]);
  });

  void it("clients cannot create, update, or delete content", async () => {
    await seedContent("published-content", "published");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);

    await assertFails(setDoc(doc(database, "content", "client-content"), {
      title: "Client content",
      shortDescription: "Must be rejected",
      type: "article",
      topics: ["testing"],
      species: ["dog"],
      body: "Client body",
      status: "published",
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    await assertFails(updateDoc(doc(database, "content", "published-content"), {
      title: "Changed by client",
    }));
    await assertFails(deleteDoc(doc(database, "content", "published-content")));
  });

  void it("authenticated user can read published guides", async () => {
    await seedGuide("published-guide", "published");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(getDoc(doc(database, "guides", "published-guide")));
  });

  void it("unauthenticated user cannot read published guides", async () => {
    await seedGuide("published-guide", "published");
    const database = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, "guides", "published-guide")));
  });

  void it("draft guides are unavailable to ordinary clients", async () => {
    await seedGuide("draft-guide", "draft");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertFails(getDoc(doc(database, "guides", "draft-guide")));
  });

  void it("published-guide query excludes drafts", async () => {
    await seedGuide("published-guide", "published");
    await seedGuide("draft-guide", "draft");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const publishedQuery = query(
      collection(database, "guides"),
      where("status", "==", "published"),
    );
    const snapshot = await assertSucceeds(getDocs(publishedQuery));

    assert.deepEqual(snapshot.docs.map((item) => item.id), ["published-guide"]);
  });

  void it("clients cannot create, update, or delete guides", async () => {
    await seedGuide("published-guide", "published");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);

    await assertFails(setDoc(doc(database, "guides", "client-guide"), {
      id: "client-guide",
      title: "Client guide",
      description: "Must be rejected",
      species: ["dog"],
      questions: [],
      results: [],
      status: "published",
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    await assertFails(updateDoc(doc(database, "guides", "published-guide"), {
      title: "Changed by client",
    }));
    await assertFails(deleteDoc(doc(database, "guides", "published-guide")));
  });

  void it("authenticated users can read published clinics", async () => {
    await seedClinic("published-clinic", "published");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertSucceeds(getDoc(doc(database, "clinics", "published-clinic")));
  });

  void it("hidden clinics are unavailable to ordinary clients", async () => {
    await seedClinic("hidden-clinic", "hidden");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    await assertFails(getDoc(doc(database, "clinics", "hidden-clinic")));
  });

  void it("unauthenticated users cannot read published clinics", async () => {
    await seedClinic("published-clinic", "published");
    const database = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, "clinics", "published-clinic")));
  });

  void it("filters published clinics by country, city, and tag", async () => {
    await seedClinic(
      "gb-general", "published", "GB", "Demo City", ["general-care"],
    );
    await seedClinic(
      "gb-urgent", "published", "GB", "Demo City", ["urgent-support"],
    );
    await seedClinic(
      "fr-general", "published", "FR", "Ville Exemple", ["general-care"],
    );
    await seedClinic(
      "hidden-general", "hidden", "GB", "Demo City", ["general-care"],
    );
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const clinics = collection(database, "clinics");

    const countrySnapshot = await assertSucceeds(getDocs(query(
      clinics,
      where("status", "==", "published"),
      where("countryCode", "==", "GB"),
    )));
    assert.deepEqual(
      countrySnapshot.docs.map((item) => item.id).sort(),
      ["gb-general", "gb-urgent"],
    );

    const citySnapshot = await assertSucceeds(getDocs(query(
      clinics,
      where("status", "==", "published"),
      where("city", "==", "Demo City"),
    )));
    assert.deepEqual(
      citySnapshot.docs.map((item) => item.id).sort(),
      ["gb-general", "gb-urgent"],
    );

    const tagSnapshot = await assertSucceeds(getDocs(query(
      clinics,
      where("status", "==", "published"),
      where("tags", "array-contains", "general-care"),
    )));
    assert.deepEqual(
      tagSnapshot.docs.map((item) => item.id).sort(),
      ["fr-general", "gb-general"],
    );
  });

  void it("clients cannot create, update, or delete clinics", async () => {
    await seedClinic("published-clinic", "published");
    const database = testEnvironment.authenticatedContext(userA).firestore();
    const timestamp = Timestamp.fromMillis(1_700_000_000_000);

    await assertFails(setDoc(doc(database, "clinics", "client-clinic"), {
      name: "Client clinic",
      countryCode: "GB",
      city: "Demo City",
      address: "Client address",
      tags: ["general-care"],
      services: ["routine-consultations"],
      status: "published",
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    await assertFails(updateDoc(doc(database, "clinics", "published-clinic"), {
      name: "Changed by client",
    }));
    await assertFails(deleteDoc(doc(database, "clinics", "published-clinic")));
  });
});
