import type {
  ContentFixture,
  ContentSpecies,
  ContentStatus,
  ContentType,
} from "./content";

const allowedKeys = new Set([
  "ageGroups",
  "body",
  "breeds",
  "checklistItems",
  "countryCodes",
  "createdAt",
  "externalUrl",
  "id",
  "shortDescription",
  "species",
  "status",
  "title",
  "topics",
  "type",
  "updatedAt",
]);

const contentTypes = new Set<ContentType>(["article", "video", "checklist"]);
const contentSpecies = new Set<ContentSpecies>(["dog", "cat", "other"]);
const contentStatuses = new Set<ContentStatus>(["draft", "published"]);

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
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
  if (!(key in value)) {
    return undefined;
  }
  return requiredString(value, key, path);
}

function stringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  required: boolean,
): string[] | undefined {
  const field = value[key];
  if (field === undefined && !required) {
    return undefined;
  }
  if (!Array.isArray(field) || field.length === 0) {
    throw new Error(`${path}.${key} must be a nonempty string array.`);
  }
  const items: string[] = [];
  for (const item of field) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`${path}.${key} must be a nonempty string array.`);
    }
    items.push(item);
  }
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
  if (field === undefined) {
    return undefined;
  }
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

function validateFixture(value: unknown, index: number): ContentFixture {
  const path = `content[${String(index)}]`;
  assertRecord(value, path);

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`${path} contains unexpected field '${key}'.`);
    }
  }

  const id = requiredString(value, "id", path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`${path}.id must be a lowercase kebab-case identifier.`);
  }

  const type = requiredString(value, "type", path) as ContentType;
  if (!contentTypes.has(type)) {
    throw new Error(`${path}.type is invalid.`);
  }

  const status = requiredString(value, "status", path) as ContentStatus;
  if (!contentStatuses.has(status)) {
    throw new Error(`${path}.status is invalid.`);
  }

  const speciesValues = stringArray(value, "species", path, true) ?? [];
  if (!speciesValues.every((item) => contentSpecies.has(item as ContentSpecies))) {
    throw new Error(`${path}.species contains an invalid value.`);
  }
  const species = speciesValues as ContentSpecies[];

  const createdAt = timestampString(value, "createdAt", path);
  const updatedAt = timestampString(value, "updatedAt", path);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Error(`${path}.updatedAt cannot precede createdAt.`);
  }

  const externalUrl = optionalHttpsUrl(value, "externalUrl", path);
  const body = optionalString(value, "body", path);
  const checklistItems = stringArray(value, "checklistItems", path, false);

  if (type === "article" && body === undefined) {
    throw new Error(`${path}.body is required for article content.`);
  }
  if (type === "video" && externalUrl === undefined) {
    throw new Error(`${path}.externalUrl is required for video content.`);
  }
  if (type === "checklist" && checklistItems === undefined) {
    throw new Error(`${path}.checklistItems is required for checklist content.`);
  }

  const countryCodes = stringArray(value, "countryCodes", path, false);
  if (countryCodes !== undefined &&
      !countryCodes.every((code) => /^[A-Z]{2}$/.test(code))) {
    throw new Error(`${path}.countryCodes must contain ISO alpha-2 codes.`);
  }
  const topics = stringArray(value, "topics", path, true) ?? [];
  const breeds = stringArray(value, "breeds", path, false);
  const ageGroups = stringArray(value, "ageGroups", path, false);

  return {
    id,
    title: requiredString(value, "title", path),
    shortDescription: requiredString(value, "shortDescription", path),
    type,
    topics,
    species,
    status,
    createdAt,
    updatedAt,
    ...(body === undefined ? {} : {body}),
    ...(externalUrl === undefined ? {} : {externalUrl}),
    ...(checklistItems === undefined ? {} : {checklistItems}),
    ...(breeds === undefined ? {} : {breeds}),
    ...(ageGroups === undefined ? {} : {ageGroups}),
    ...(countryCodes === undefined ? {} : {countryCodes}),
  };
}

export function parseContentFixtures(value: unknown): ContentFixture[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Content fixtures must be a nonempty array.");
  }

  const fixtures = value.map(validateFixture);
  const ids = fixtures.map((fixture) => fixture.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Content fixture IDs must be unique.");
  }

  return fixtures.sort((left, right) => left.id.localeCompare(right.id));
}
