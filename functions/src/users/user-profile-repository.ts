import {FieldValue, Timestamp} from "firebase-admin/firestore";

import {adminFirestore} from "../core/firebase-admin";
import type {
  AuthenticatedIdentity,
  UserProfile,
} from "./user-profile";

export interface UserProfileRepository {
  ensure(identity: AuthenticatedIdentity): Promise<UserProfile>;
}

function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const profile = value as Partial<UserProfile>;
  return typeof profile.uid === "string" &&
    typeof profile.email === "string" &&
    profile.createdAt instanceof Timestamp &&
    profile.updatedAt instanceof Timestamp;
}

export const firestoreUserProfileRepository: UserProfileRepository = {
  async ensure(identity): Promise<UserProfile> {
    const profileReference = adminFirestore.collection("users").doc(identity.uid);

    await adminFirestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileReference);

      if (snapshot.exists) {
        return;
      }

      transaction.create(profileReference, {
        uid: identity.uid,
        email: identity.email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const snapshot = await profileReference.get();
    const profile = snapshot.data();

    if (!isUserProfile(profile)) {
      throw new Error(`Invalid user profile at users/${identity.uid}.`);
    }

    return profile;
  },
};
