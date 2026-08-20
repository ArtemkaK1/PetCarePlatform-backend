import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {describe, it} from "node:test";

import {parseClinicFixtures} from "../../src/clinics/clinic-fixture";

async function loadVersionedFixtures(): Promise<unknown> {
  const path = resolve(process.cwd(), "../seed/fixtures/clinics.json");
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

void describe("clinic fixture validation", () => {
  void it("parses and deterministically sorts clearly marked demo clinics", async () => {
    const fixtures = parseClinicFixtures(await loadVersionedFixtures());

    assert.equal(fixtures.length, 5);
    assert.deepEqual(
      fixtures.map((fixture) => fixture.id),
      [...fixtures.map((fixture) => fixture.id)].sort(),
    );
    assert.equal(
      fixtures.every((fixture) => fixture.name.startsWith("Demo Clinic:")),
      true,
    );
    assert.equal(fixtures.filter((fixture) => fixture.status === "hidden").length, 1);
  });

  void it("rejects unexpected fields and duplicate IDs", async () => {
    const fixtures = await loadVersionedFixtures();
    assert.ok(Array.isArray(fixtures));
    const unexpected = structuredClone(fixtures[0]) as Record<string, unknown>;
    unexpected.partner = true;
    assert.throws(() => parseClinicFixtures([unexpected]), /unexpected field/u);

    assert.throws(
      () => parseClinicFixtures([fixtures[0], fixtures[0]]),
      /IDs must be unique/u,
    );
  });

  void it("requires valid paired coordinates", async () => {
    const fixtures = await loadVersionedFixtures();
    assert.ok(Array.isArray(fixtures));
    const missingLongitude = structuredClone(fixtures[0]) as Record<string, unknown>;
    delete missingLongitude.longitude;
    assert.throws(
      () => parseClinicFixtures([missingLongitude]),
      /latitude and longitude must be provided together/u,
    );

    const invalidLatitude = structuredClone(fixtures[0]) as Record<string, unknown>;
    invalidLatitude.latitude = 91;
    assert.throws(
      () => parseClinicFixtures([invalidLatitude]),
      /latitude must be between/u,
    );
  });

  void it("rejects invalid country codes, URLs, and timestamps", async () => {
    const fixtures = await loadVersionedFixtures();
    assert.ok(Array.isArray(fixtures));

    const invalidCountry = structuredClone(fixtures[1]) as Record<string, unknown>;
    invalidCountry.countryCode = "gb";
    assert.throws(() => parseClinicFixtures([invalidCountry]), /ISO alpha-2/u);

    const invalidUrl = structuredClone(fixtures[1]) as Record<string, unknown>;
    invalidUrl.websiteUrl = "http://example.invalid";
    assert.throws(() => parseClinicFixtures([invalidUrl]), /valid HTTPS URL/u);

    const invalidTimestamp = structuredClone(fixtures[1]) as Record<string, unknown>;
    invalidTimestamp.updatedAt = "2025-01-01T00:00:00.000Z";
    assert.throws(
      () => parseClinicFixtures([invalidTimestamp]),
      /cannot precede createdAt/u,
    );
  });
});
