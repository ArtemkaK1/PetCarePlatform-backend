# PetCarePlatform backend

Firebase backend for the existing `PetCarePlatform` Firebase project (`volrik-pet-care-platform`). It uses strict TypeScript, Node.js 22, Firebase Admin, 2nd-generation Cloud Functions in `europe-west1`, deny-by-default Firestore rules, and the Local Emulator Suite.

The implemented product scope is intentionally limited to authenticated user profiles, user-owned pets, curated demo content, and deterministic metadata-based recommendations.

## Prerequisites

- Node.js 22 (`nvm install && nvm use`)
- npm
- Java 21 or another version supported by the Firebase emulators
- Firebase CLI (`npm install --global firebase-tools`)

The remote Firestore database is expected to have been created in `eur3`. Its location is a Firebase project setting and is not initialized or changed by this repository.

## Install and verify

From the repository root:

```sh
nvm use
npm ci
npm --prefix functions ci
npm run build
npm run lint
npm test
```

`npm test` runs unit tests, then starts the Authentication, Firestore, and Functions emulators for callable and security-rules integration tests. To run the stages separately:

```sh
npm run test:unit
npm run test:integration
```

Start Authentication, Firestore, and Functions emulators, plus the Emulator Suite UI:

```sh
npm run emulators
```

The UI is available at <http://127.0.0.1:4000>. To start all required emulators, run every test, and stop cleanly:

```sh
npm run emulators:exec
```

All Firebase CLI scripts explicitly target `volrik-pet-care-platform`. The default alias in `.firebaserc` points to that same project. Emulator data is local; no deployment is performed by these commands.

## Collections

### `users/{uid}`

- `uid`: string
- `email`: string
- `createdAt`: Firestore timestamp
- `updatedAt`: Firestore timestamp

The authenticated `ensureUserProfile` callable derives `uid` and `email` only from Firebase Authentication. It creates the document with server timestamps when missing and returns the existing document unchanged on subsequent calls. Clients may read only their own profile and cannot write user-profile documents directly.

### `pets/{petId}`

- `ownerId`: string
- `name`: string
- `species`: `dog | cat | other`
- `sex`: `male | female | unknown`
- `birthDate`: optional Firestore timestamp
- `breed`: optional normalized breed string
- `countryCode`: optional uppercase ISO alpha-2 code
- `createdAt`: Firestore timestamp
- `updatedAt`: Firestore timestamp

Pet CRUD uses the Firestore client SDK directly. On creation, clients must set `ownerId` to the authenticated user's UID and use Firestore server timestamps for `createdAt` and `updatedAt`. Updates must preserve `ownerId` and `createdAt` and set `updatedAt` with a server timestamp. Only the owner can create, read, update, or delete a pet; unexpected fields are rejected.

### `content/{contentId}`

- `title`: string
- `shortDescription`: string
- `type`: `article | video | checklist`
- `topics`: string array
- `species`: nonempty array containing `dog`, `cat`, and/or `other`
- `breeds`: optional string array
- `ageGroups`: optional string array
- `countryCodes`: optional ISO alpha-2 code array
- `externalUrl`: optional HTTPS URL; required for videos
- `body`: article text, required for articles
- `checklistItems`: string array, required for checklists
- `status`: `draft | published`
- `createdAt`: Firestore timestamp
- `updatedAt`: Firestore timestamp

Authenticated clients can read only documents whose status is `published`. Intended collection queries must include `where("status", "==", "published")`. Drafts are not client-readable, and every client content write is denied. Curated backend tooling writes through the Admin SDK.

No composite index is needed for the implemented status-only query, so `firestore.indexes.json` remains empty.

## Demo content seed

The version-controlled fixture at `seed/fixtures/content.json` contains 10 clearly marked, deterministic demo entries. The entries are product/test samples and do not represent verified medical advice.

Start the Emulator Suite in one terminal:

```sh
npm run emulators
```

Then run the default seed command in another terminal. It compiles the seed tool, targets the running Firestore emulator at `127.0.0.1:8080`, validates the fixture, and writes deterministic document IDs and timestamps:

```sh
npm run seed:content
```

Repeated runs overwrite the same 10 document IDs with the same values. Remote writes are disabled by default. The only accepted remote command requires both explicit safety flags and the exact current MVP project ID:

```sh
npm --prefix functions run seed:content -- \
  --remote \
  --confirm-remote-seed \
  --project volrik-pet-care-platform
```

Remote seeding uses Application Default Credentials. The tool aborts for every other project ID, including any future production project, and also aborts if `FIRESTORE_EMULATOR_HOST` is set during a remote attempt.

## Personalized content callable

`getPersonalizedContent` is a 2nd-generation callable function in `europe-west1`.

Request:

```ts
{
  petId: string;
  limit?: number; // integer from 1 through 20; defaults to 10
}
```

Authentication is required. The function loads `pets/{petId}` using the Admin SDK and verifies that its stored `ownerId` equals the authenticated UID; it never accepts an owner ID from request data. Missing pets return `not-found`, and pets owned by another user return `permission-denied`.

The function queries only content whose status is `published`, excludes documents whose `species` array does not include the selected pet's species, and applies this deterministic score:

- species match: 100 points and `species_match`;
- breed match: 30 additional points and `breed_match`;
- age-group match: 20 additional points and `age_match`;
- country match: 10 additional points and `country_match`.

Breed matching is case-insensitive. Country codes are matched case-insensitively. Age group is derived from `birthDate` at request time: under 12 months is `puppy`, `kitten`, or `young`; 12–83 months is `adult`; 84 months and older is `senior`. Missing pet or content metadata is neutral rather than inferred.

Results sort by descending score and then ascending content document ID as a stable tie-breaker. Each item includes the published content fields, numeric `score`, and machine-readable `reasons`. The score represents metadata matching only and must not be interpreted as medical relevance. No AI, machine learning, embeddings, external APIs, or vector search are used.

## Security

Firestore rules allow only the ownership and published-content reads described above. Every unspecified path is denied by default. Keep credentials, service-account JSON files, and secrets out of the repository. Local Functions and seed tooling use Application Default Credentials supplied by their environment; deployed Functions use their managed service identity.
