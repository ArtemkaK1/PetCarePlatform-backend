import type {CallableRequest} from "firebase-functions/v2/https";
import {HttpsError, onCall} from "firebase-functions/v2/https";

import type {
  AuthenticatedIdentity,
  UserProfile,
  UserProfileResponse,
} from "./user-profile";
import {
  firestoreUserProfileRepository,
  type UserProfileRepository,
} from "./user-profile-repository";

export function getAuthenticatedIdentity(
  request: Pick<CallableRequest<unknown>, "auth">,
): AuthenticatedIdentity {
  if (request.auth === undefined) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const email = request.auth.token.email;
  if (typeof email !== "string" || email.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "The authenticated account must have an email address.",
    );
  }

  return {uid: request.auth.uid, email};
}

export async function ensureProfile(
  identity: AuthenticatedIdentity,
  repository: UserProfileRepository,
): Promise<UserProfile> {
  return repository.ensure(identity);
}

function toResponse(profile: UserProfile): UserProfileResponse {
  return {
    uid: profile.uid,
    email: profile.email,
    createdAt: profile.createdAt.toDate().toISOString(),
    updatedAt: profile.updatedAt.toDate().toISOString(),
  };
}

export const ensureUserProfile = onCall(
  {region: "europe-west1"},
  async (request): Promise<UserProfileResponse> => {
    const identity = getAuthenticatedIdentity(request);

    try {
      const profile = await ensureProfile(
        identity,
        firestoreUserProfileRepository,
      );
      return toResponse(profile);
    } catch (error: unknown) {
      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Unable to ensure user profile.");
    }
  },
);
