import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

type FirebaseAuthError = {
  code?: string;
};

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "FirebaseClientConfigurationError") {
    return "Firebase Authentication is not configured yet. Add the client Firebase variables to enable account access.";
  }

  const code = (error as FirebaseAuthError | undefined)?.code;
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support for help.";
    case "auth/too-many-requests":
      return "Too many attempts were made. Please wait a little while and try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 8 characters.";
    case "auth/operation-not-allowed":
      return "Email and password sign-in is not enabled for this Firebase project yet.";
    case "auth/network-request-failed":
      return "We could not reach Firebase. Check your connection and try again.";
    default:
      return "Authentication could not be completed. Please try again.";
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return result.user;
}

export async function signUp(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await sendEmailVerification(result.user);
  return result.user;
}

export async function sendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function refreshUser(user: User): Promise<User> {
  await reload(user);
  const refreshedUser = getFirebaseAuth().currentUser ?? user;
  if (refreshedUser.emailVerified) {
    await refreshedUser.getIdToken(true);
  }
  return refreshedUser;
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth());
}