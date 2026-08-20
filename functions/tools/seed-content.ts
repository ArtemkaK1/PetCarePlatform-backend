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
import {parseGuideFixtures} from "../src/guides/guide-fixture";
import type {GuideDocument} from "../src/guides/guide";
import {
  parseSeedArguments,
  resolveSeedTarget,
} from "../src/content/seed-target";

const contentFixturePath = resolve(
  __dirname,
  "../../../seed/fixtures/content.json",
);
const guideFixturePath = resolve(
  __dirname,
  "../../../seed/fixtures/guides.json",
);

async function loadFixtures(): Promise<{
  content: ReturnType<typeof parseContentFixtures>;
  guides: ReturnType<typeof parseGuideFixtures>;
}> {
  const [contentSource, guideSource] = await Promise.all([
    readFile(contentFixturePath, "utf8"),
    readFile(guideFixturePath, "utf8"),
  ]);
  return {
    content: parseContentFixtures(JSON.parse(contentSource) as unknown),
    guides: parseGuideFixtures(JSON.parse(guideSource) as unknown),
  };
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

    for (const fixture of fixtures.content) {
      const {createdAt, id, updatedAt, ...fields} = fixture;
      const document: ContentDocument = {
        ...fields,
        createdAt: Timestamp.fromDate(new Date(createdAt)),
        updatedAt: Timestamp.fromDate(new Date(updatedAt)),
      };
      batch.set(database.collection("content").doc(id), document);
    }

    for (const fixture of fixtures.guides) {
      const {createdAt, id, updatedAt, ...fields} = fixture;
      const document: GuideDocument = {
        ...fields,
        id,
        createdAt: Timestamp.fromDate(new Date(createdAt)),
        updatedAt: Timestamp.fromDate(new Date(updatedAt)),
      };
      batch.set(database.collection("guides").doc(id), document);
    }

    await batch.commit();
    const targetLabel = target.mode === "emulator" ?
      `Firestore emulator at ${String(emulatorHost)}` :
      `remote project ${target.projectId}`;
    process.stdout.write(
      `Seeded ${String(fixtures.content.length)} content and ` +
      `${String(fixtures.guides.length)} guide fixtures into ${targetLabel}.\n`,
    );
  } finally {
    await deleteApp(app);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Fixture seed aborted: ${message}\n`);
  process.exitCode = 1;
});
