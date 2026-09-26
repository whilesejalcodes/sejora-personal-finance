import { useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  getMissingFirebaseClientConfig,
  initializeFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase";
import {
  logout,
  refreshUser,
  sendResetEmail,
  sendVerificationEmail,
  signIn,
  signUp,
} from "@/lib/firebase-auth";
import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = isFirebaseClientConfigured();
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [loading, setLoading] = useState(isConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    let disposed = false;
    let unsubscribe = () => {};

    void initializeFirebaseAuth()
      .then((auth) => {
        if (disposed) {
          return;
        }
        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          setUser(nextUser);
          setLoading(false);
        });
      })
      .catch((error: unknown) => {
        if (disposed) {
          return;
        }
        setAuthError(error instanceof Error ? error.message : "Authentication could not be initialized.");
        setLoading(false);
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [isConfigured]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: user !== null,
    isEmailVerified: user?.emailVerified ?? false,
    isConfigured,
    missingConfig: getMissingFirebaseClientConfig(),
    authError,
    signIn: async (email, password) => {
      const nextUser = await signIn(email, password);
      setAuthError(null);
      return nextUser;
    },
    signUp: async (email, password) => {
      const nextUser = await signUp(email, password);
      setAuthError(null);
      return nextUser;
    },
    sendResetEmail: async (email) => {
      await sendResetEmail(email);
    },
    sendVerificationEmail: async () => {
      if (!user) {
        throw new Error("There is no signed-in user to verify.");
      }
      await sendVerificationEmail(user);
    },
    refreshVerification: async () => {
      if (!user) {
        return null;
      }
      const refreshedUser = await refreshUser(user);
      setUser(refreshedUser);
      setAuthRevision((revision) => revision + 1);
      return refreshedUser;
    },
    logout: async () => {
      if (isConfigured) {
        await logout();
      } else {
        setUser(null);
      }
    },
  }), [authError, authRevision, isConfigured, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}