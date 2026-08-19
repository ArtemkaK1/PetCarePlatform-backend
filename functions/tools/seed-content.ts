import {readFile} from "node:fs/promises";
import {resolve} from "node:path";

import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";

import {parseContentFixtures} from "../src/content/content-fixture";
import type {ContentDocument} from "../src/content/content";
import {
  parseSeedArguments,
  resolveSeedTarget,
} from "../src/content/seed-target";

const fixturePath = resolve(
  __dirname,
  "../../../seed/fixtures/content.json",
);

async function loadFixtures(): Promise<ReturnType<typeof parseContentFixtures>> {
  const source = await readFile(fixturePath, "utf8");
  return parseContentFixtures(JSON.parse(source) as unknown);
}

async function main(): Promise<void> {
  const arguments_ = parseSeedArguments(process.argv.slice(2));
  const configuredEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const emulatorHost = arguments_.remote ?
    configuredEmulatorHost : configuredEmulatorHost ?? "127.0.0.1:8080";
  const target = resolveSeedTarget(arguments_, emulatorHost);

  if (target.mode === "remote" && emulatorHost !== undefined) {
    throw new Error(
      "Refusing remote seed while FIRESTORE_EMULATOR_HOST is set. Unset it and retry.",
    );
  }
  if (target.mode === "emulator") {
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    process.env.METADATA_SERVER_DETECTION ??= "none";
  }

  const fixtures = await loadFixtures();
  const app = initializeApp({
    projectId: target.projectId,
    credential: applicationDefault(),
  }, "content-seed");

  try {
    const database = getFirestore(app);
    const batch = database.batch();

    for (const fixture of fixtures) {
      const {createdAt, id, updatedAt, ...fields} = fixture;
      const document: ContentDocument = {
        ...fields,
        createdAt: Timestamp.fromDate(new Date(createdAt)),
        updatedAt: Timestamp.fromDate(new Date(updatedAt)),
      };
      batch.set(database.collection("content").doc(id), document);
    }

    await batch.commit();
    const targetLabel = target.mode === "emulator" ?
      `Firestore emulator at ${String(emulatorHost)}` :
      `remote project ${target.projectId}`;
    process.stdout.write(
      `Seeded ${String(fixtures.length)} deterministic content fixtures into ${targetLabel}.\n`,
    );
  } finally {
    await deleteApp(app);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Content seed aborted: ${message}\n`);
  process.exitCode = 1;
});
