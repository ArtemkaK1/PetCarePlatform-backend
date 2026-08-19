import {Timestamp} from "firebase-admin/firestore";
import type {CallableRequest} from "firebase-functions/v2/https";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {error as logError} from "firebase-functions/logger";

import type {
  ContentDocument,
  ContentSpecies,
  ContentType,
} from "../content/content";
import {adminFirestore} from "../core/firebase-admin";
import {
  derivePetAgeGroup,
  recommendContent,
  type RecommendableContent,
  type RecommendationReason,
} from "./recommend-content";

const defaultLimit = 10;
const maximumLimit = 20;
const contentTypes = new Set<ContentType>(["article", "video", "checklist"]);
const contentSpecies = new Set<ContentSpecies>(["dog", "cat", "other"]);

export interface PersonalizedContentRequest {
  limit: number;
  petId: string;
}

interface ContentCandidate extends ContentDocument, RecommendableContent {
  id: string;
}

interface PersonalizedContentItem extends Omit<
  ContentCandidate,
  "createdAt" | "id" | "status" | "updatedAt"
> {
  contentId: string;
  createdAt: string;
  reasons: RecommendationReason[];
  score: number;
  status: "published";
  updatedAt: string;
}

export interface PersonalizedContentResponse {
  items: PersonalizedContentItem[];
  petId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string");
}

function optionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || isStringArray(value);
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function parsePersonalizedContentRequest(
  value: unknown,
): PersonalizedContentRequest {
  if (!isRecord(value)) {
    throw new HttpsError("invalid-argument", "Request data must be an object.");
  }
  const allowedKeys = new Set(["petId", "limit"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new HttpsError("invalid-argument", "Request contains unexpected fields.");
  }

  const petId = value.petId;
  if (typeof petId !== "string" ||
      petId.trim().length === 0 ||
      petId.includes("/")) {
    throw new HttpsError("invalid-argument", "petId must be a valid document ID.");
  }

  const limit = value.limit === undefined ? defaultLimit : value.limit;
  if (typeof limit !== "number" ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > maximumLimit) {
    throw new HttpsError(
      "invalid-argument",
      `limit must be an integer from 1 to ${String(maximumLimit)}.`,
    );
  }

  return {petId, limit};
}

function parseContentCandidate(
  id: string,
  value: unknown,
): ContentCandidate {
  if (!isRecord(value) ||
      typeof value.title !== "string" ||
      typeof value.shortDescription !== "string" ||
      typeof value.type !== "string" ||
      !contentTypes.has(value.type as ContentType) ||
      !isStringArray(value.topics) ||
      !isStringArray(value.species) ||
      !value.species.every((species) => contentSpecies.has(species as ContentSpecies)) ||
      value.status !== "published" ||
      !(value.createdAt instanceof Timestamp) ||
      !(value.updatedAt instanceof Timestamp) ||
      !optionalStringArray(value.breeds) ||
      !optionalStringArray(value.ageGroups) ||
      !optionalStringArray(value.countryCodes) ||
      !optionalStringArray(value.checklistItems) ||
      !optionalString(value.body) ||
      !optionalString(value.externalUrl)) {
    throw new Error(`Invalid published content document content/${id}.`);
  }

  return {
    id,
    title: value.title,
    shortDescription: value.shortDescription,
    type: value.type as ContentType,
    topics: value.topics,
    species: value.species as ContentSpecies[],
    status: "published",
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(value.breeds === undefined ? {} : {breeds: value.breeds}),
    ...(value.ageGroups === undefined ? {} : {ageGroups: value.ageGroups}),
    ...(value.countryCodes === undefined ? {} : {countryCodes: value.countryCodes}),
    ...(value.checklistItems === undefined ? {} : {
      checklistItems: value.checklistItems,
    }),
    ...(value.body === undefined ? {} : {body: value.body}),
    ...(value.externalUrl === undefined ? {} : {externalUrl: value.externalUrl}),
  };
}

function toResponseItem(
  recommendation: ReturnType<typeof recommendContent<ContentCandidate>>[number],
): PersonalizedContentItem {
  const {content, reasons, score} = recommendation;
  const {createdAt, id, updatedAt, ...fields} = content;
  return {
    ...fields,
    contentId: id,
    createdAt: createdAt.toDate().toISOString(),
    updatedAt: updatedAt.toDate().toISOString(),
    status: "published",
    reasons,
    score,
  };
}

export const getPersonalizedContent = onCall(
  {region: "europe-west1"},
  async (request: CallableRequest<unknown>): Promise<PersonalizedContentResponse> => {
    if (request.auth === undefined) {
      throw new HttpsError("unauthenticated", "Authentication is required.");
    }
    const input = parsePersonalizedContentRequest(request.data);

    try {
      const petSnapshot = await adminFirestore.collection("pets").doc(input.petId).get();
      if (!petSnapshot.exists) {
        throw new HttpsError("not-found", "Pet not found.");
      }

      const pet = petSnapshot.data();
      if (pet?.ownerId !== request.auth.uid) {
        throw new HttpsError(
          "permission-denied",
          "The authenticated user does not own this pet.",
        );
      }
      if (typeof pet.species !== "string" ||
          !contentSpecies.has(pet.species as ContentSpecies) ||
          (pet.breed !== undefined && typeof pet.breed !== "string") ||
          (pet.countryCode !== undefined && typeof pet.countryCode !== "string") ||
          (pet.birthDate !== undefined && !(pet.birthDate instanceof Timestamp))) {
        throw new Error(`Invalid pet document pets/${input.petId}.`);
      }

      const species = pet.species as ContentSpecies;
      const ageGroup = derivePetAgeGroup(
        species,
        pet.birthDate instanceof Timestamp ? pet.birthDate.toDate() : undefined,
        new Date(),
      );
      const publishedSnapshot = await adminFirestore
        .collection("content")
        .where("status", "==", "published")
        .get();
      const candidates = publishedSnapshot.docs.map((snapshot) =>
        parseContentCandidate(snapshot.id, snapshot.data()));
      const recommendations = recommendContent({
        species,
        ...(typeof pet.breed === "string" ? {breed: pet.breed} : {}),
        ...(typeof pet.countryCode === "string" ?
          {countryCode: pet.countryCode} : {}),
        ...(ageGroup === undefined ? {} : {ageGroup}),
      }, candidates, input.limit);

      return {
        petId: input.petId,
        items: recommendations.map(toResponseItem),
      };
    } catch (error: unknown) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logError("getPersonalizedContent failed", error);
      throw new HttpsError("internal", "Unable to get personalized content.");
    }
  },
);
