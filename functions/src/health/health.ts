import {HttpsError, onCall} from "firebase-functions/v2/https";

import "../core/firebase-admin";

export interface HealthResponse {
  status: "ok";
}

export function createHealthResponse(): HealthResponse {
  return {status: "ok"};
}

export const health = onCall({region: "europe-west1"}, (request) => {
  if (request.auth === undefined) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  return createHealthResponse();
});
