# CareBridge security and setup notes

## Firebase setup

1. Create/copy a Firebase Web App configuration into a local `.env` file using `.env.example`.
2. Required variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`. `VITE_FIREBASE_MEASUREMENT_ID` is optional.
3. Enable Email/Password in Firebase Authentication and create the Firestore database.
4. Publish `firestore.rules` in the Firebase Console before using real accounts.
5. Run `npm install`, then `npm run lint` and `npm run build`.

## Important scope and data safety

- The app no longer initializes a real account from demo/local browser data. Missing Firebase configuration fails closed for sign-in/sign-up.
- First-run local data state starts empty; presentation fixtures remain in source for isolated demo use, but are not automatically loaded into user sessions.
- Emergency case form/session state is not persisted in shared browser localStorage.
- Current emergency case/request orchestration is not yet a complete Firestore-backed workflow. Do not use this build to coordinate real emergencies or store real patient/clinical information until that workflow, consent-based attendant linking, server-side validation, and security-rule tests are implemented and independently reviewed.
- Firestore rules are tightened around record ownership and provider access. Queries must include filters compatible with these rules; Firestore rules are not query filters.
- Public signup cannot create an admin account. Existing admin accounts must be provisioned through a trusted administrative process.
- Never commit `.env`, service-account JSON, private keys, passwords, or other secrets. The `.env` file is excluded from the delivered ZIP; recreate it locally from `.env.example`.

## Existing account note

The app retains the existing `patient` role for the combined Patient/Attendant experience. It does not automatically change any existing user's role.
