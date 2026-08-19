import type {Timestamp} from "firebase-admin/firestore";

export interface AuthenticatedIdentity {
  email: string;
  uid: string;
}

export interface UserProfile {
  createdAt: Timestamp;
  email: string;
  uid: string;
  updatedAt: Timestamp;
}

export interface UserProfileResponse {
  createdAt: string;
  email: string;
  uid: string;
  updatedAt: string;
}
