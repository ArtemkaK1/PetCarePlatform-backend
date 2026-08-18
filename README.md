# PetCarePlatform backend

Minimal Firebase backend foundation for the existing `PetCarePlatform` Firebase project (`volrik-pet-care-platform`). It uses strict TypeScript, Node.js 22, Firebase Admin, 2nd-generation Cloud Functions in `europe-west1`, deny-by-default Firestore rules, and the Local Emulator Suite.

No product domains are implemented. The only exported function is an authenticated callable health check used to verify the Functions foundation.

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
npm --prefix functions install
npm run build
npm run lint
npm test
```

Start Authentication, Firestore, and Functions emulators, plus the Emulator Suite UI:

```sh
npm run emulators
```

The UI is available at <http://127.0.0.1:4000>. To start the emulators, run the test suite, and stop them automatically:

```sh
npm run emulators:exec
```

All Firebase CLI scripts explicitly target `volrik-pet-care-platform`. The default alias in `.firebaserc` points to that same project. Emulator data is local; no deployment is performed by these commands.

## Security

Firestore rules deny every client read and write. Keep credentials, service-account JSON files, and secrets out of the repository. Local Functions use Application Default Credentials supplied by the Firebase emulator environment; deployed Functions use their managed service identity.
