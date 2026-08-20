import type {ClinicFixture, ClinicStatus} from "./clinic";

const allowedKeys = new Set([
  "address",
  "bookingUrl",
  "city",
  "countryCode",
  "createdAt",
  "emergency",
  "id",
  "latitude",
  "longitude",
  "name",
  "phone",
  "services",
  "status",
  "tags",
  "updatedAt",
  "websiteUrl",
]);
const statuses = new Set<ClinicStatus>(["hidden", "published"]);

function assertRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const field = value[key];
  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(`${path}.${key} must be a nonempty string.`);
  }
  return field;
}

function optionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  return key in value ? requiredString(value, key, path) : undefined;
}

function identifier(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const field = requiredString(value, key, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(field)) {
    throw new Error(`${path}.${key} must be a lowercase kebab-case identifier.`);
  }
  return field;
}

function stringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string[] {
  const field = value[key];
  if (!Array.isArray(field) || field.length === 0 ||
      !field.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`${path}.${key} must be a nonempty string array.`);
  }
  const items = field as string[];
  if (new Set(items).size !== items.length) {
    throw new Error(`${path}.${key} must not contain duplicates.`);
  }
  return items;
}

function timestampString(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const field = requiredString(value, key, path);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(field) ||
      !Number.isFinite(Date.parse(field))) {
    throw new Error(`${path}.${key} must be an ISO-8601 UTC timestamp.`);
  }
  return field;
}

function optionalHttpsUrl(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const field = optionalString(value, key, path);
  if (field === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(field);
  } catch {
    throw new Error(`${path}.${key} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${path}.${key} must be a valid HTTPS URL.`);
  }
  return field;
}

function optionalCoordinate(
  value: Record<string, unknown>,
  key: "latitude" | "longitude",
  path: string,
): number | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  const limit = key === "latitude" ? 90 : 180;
  if (typeof field !== "number" || !Number.isFinite(field) ||
      field < -limit || field > limit) {
    throw new Error(`${path}.${key} must be between -${String(limit)} and ${String(limit)}.`);
  }
  return field;
}

function validateFixture(value: unknown, index: number): ClinicFixture {
  const path = `clinics[${String(index)}]`;
  assertRecord(value, path);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${path} contains unexpected field '${key}'.`);
    }
  }

  const countryCode = requiredString(value, "countryCode", path);
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error(`${path}.countryCode must be an ISO alpha-2 code.`);
  }
  const status = requiredString(value, "status", path) as ClinicStatus;
  if (!statuses.has(status)) {
    throw new Error(`${path}.status is invalid.`);
  }
  const latitude = optionalCoordinate(value, "latitude", path);
  const longitude = optionalCoordinate(value, "longitude", path);
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new Error(`${path}.latitude and longitude must be provided together.`);
  }
  const emergency = value.emergency;
  if (emergency !== undefined && typeof emergency !== "boolean") {
    throw new Error(`${path}.emergency must be a boolean.`);
  }
  const phone = optionalString(value, "phone", path);
  if (phone !== undefined && !/^\+?[0-9 ()-]{7,25}$/.test(phone)) {
    throw new Error(`${path}.phone has an invalid format.`);
  }
  const createdAt = timestampString(value, "createdAt", path);
  const updatedAt = timestampString(value, "updatedAt", path);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Error(`${path}.updatedAt cannot precede createdAt.`);
  }
  const websiteUrl = optionalHttpsUrl(value, "websiteUrl", path);
  const bookingUrl = optionalHttpsUrl(value, "bookingUrl", path);

  return {
    id: identifier(value, "id", path),
    name: requiredString(value, "name", path),
    countryCode,
    city: requiredString(value, "city", path),
    address: requiredString(value, "address", path),
    tags: stringArray(value, "tags", path),
    services: stringArray(value, "services", path),
    status,
    createdAt,
    updatedAt,
    ...(latitude === undefined ? {} : {latitude, longitude}),
    ...(websiteUrl === undefined ? {} : {websiteUrl}),
    ...(bookingUrl === undefined ? {} : {bookingUrl}),
    ...(phone === undefined ? {} : {phone}),
    ...(emergency === undefined ? {} : {emergency}),
  };
}

export function parseClinicFixtures(value: unknown): ClinicFixture[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Clinic fixtures must be a nonempty array.");
  }
  const fixtures = value.map(validateFixture);
  if (new Set(fixtures.map((fixture) => fixture.id)).size !== fixtures.length) {
    throw new Error("Clinic fixture IDs must be unique.");
  }
  return fixtures.sort((left, right) => left.id.localeCompare(right.id));
}
