# PetCarePlatform backend

Firebase backend for the existing `PetCarePlatform` Firebase project (`volrik-pet-care-platform`). It uses strict TypeScript, Node.js 22, Firebase Admin, 2nd-generation Cloud Functions in `europe-west1`, deny-by-default Firestore rules, and the Local Emulator Suite.

The implemented product scope is intentionally limited to authenticated user profiles and user-owned pets.

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
- `createdAt`: Firestore timestamp
- `updatedAt`: Firestore timestamp

Pet CRUD uses the Firestore client SDK directly. On creation, clients must set `ownerId` to the authenticated user's UID and use Firestore server timestamps for `createdAt` and `updatedAt`. Updates must preserve `ownerId` and `createdAt` and set `updatedAt` with a server timestamp. Only the owner can create, read, update, or delete a pet; unexpected fields are rejected.

## Security

Firestore rules allow only the ownership operations described above. Every unspecified path is denied by default. Keep credentials, service-account JSON files, and secrets out of the repository. Local Functions use Application Default Credentials supplied by the Firebase emulator environment; deployed Functions use their managed service identity.
