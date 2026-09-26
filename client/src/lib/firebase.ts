import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const environmentKeys = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  appId: "VITE_FIREBASE_APP_ID",
} as const;

const requiredConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => environmentKeys[key as keyof typeof environmentKeys]);

export class FirebaseClientConfigurationError extends Error {
  readonly missingKeys: string[];

  constructor() {
    super("Firebase client configuration is incomplete.");
    this.name = "FirebaseClientConfigurationError";
    this.missingKeys = requiredConfigKeys;
  }
}

export function isFirebaseClientConfigured(): boolean {
  return requiredConfigKeys.length === 0;
}

export function getMissingFirebaseClientConfig(): string[] {
  return [...requiredConfigKeys];
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new FirebaseClientConfigurationError();
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export async function initializeFirebaseAuth(): Promise<Auth> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  return auth;
}