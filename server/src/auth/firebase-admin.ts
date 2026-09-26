import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const requiredConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
};

const missingConfigKeys = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export class FirebaseAdminConfigurationError extends Error {
  readonly missingKeys: string[];

  constructor() {
    super("Firebase Admin configuration is incomplete.");
    this.name = "FirebaseAdminConfigurationError";
    this.missingKeys = missingConfigKeys;
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return missingConfigKeys.length === 0;
}

function getFirebaseAdminApp(): App {
  if (!isFirebaseAdminConfigured()) {
    throw new FirebaseAdminConfigurationError();
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId: requiredConfig.projectId,
      clientEmail: requiredConfig.clientEmail,
      privateKey: requiredConfig.privateKey?.replace(/\\n/g, "\n"),
    }),
  });
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}