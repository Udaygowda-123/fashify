"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { apiFetch } from "@/lib/api/client";
import { firebaseAuth, isFirebaseConfigured } from "./client";

/**
 * The one piece of shared auth state. It tracks the signed-in Firebase user
 * and exposes a fresh ID token on demand — "fresh" matters, because a token
 * is only valid for an hour and `getIdToken()` renews it transparently when
 * it is close to expiring.
 *
 * Sign-in and sign-up here call Firebase directly from the browser, exactly
 * as the brief specifies: the server never sees a password, only the ID token
 * Firebase issues afterwards, which it verifies with the Admin SDK.
 */
interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  configured: boolean;
  /**
   * Read from the ID token's own custom claims — the same claim the server's
   * requireAdmin middleware reads (see server/src/middleware/auth.ts). Set
   * with `npm run grant-admin` on the server; nothing client-side can grant it.
   */
  isAdmin: boolean;
  getIdToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Merges the guest bag into the signed-in user's, and reports what changed. */
async function mergeGuestCart(idToken: string) {
  return apiFetch<{ dropped: { name: string; reason: string }[] }>("/cart/merge", {
    method: "POST",
    idToken,
  }).catch(() => null);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth(), (next) => {
      setUser(next);
      setLoading(false);
      if (!next) {
        setIsAdmin(false);
        return;
      }
      next
        .getIdTokenResult()
        .then((result) => {
          setIsAdmin(result.claims.role === "admin" || result.claims.admin === true);
        })
        .catch(() => setIsAdmin(false));
    });
    return unsubscribe;
  }, []);

  const getIdToken = useCallback(async () => {
    if (!isFirebaseConfigured || !firebaseAuth().currentUser) return null;
    return firebaseAuth().currentUser!.getIdToken();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth(), email, password);
    const token = await firebaseAuth().currentUser?.getIdToken();
    if (token) await mergeGuestCart(token);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const credential = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
    if (name.trim()) {
      await updateProfile(credential.user, { displayName: name.trim() });
    }
    const token = await credential.user.getIdToken();
    await mergeGuestCart(token);
  }, []);

  const signOutUser = useCallback(async () => {
    await firebaseSignOut(firebaseAuth());
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      isAdmin,
      getIdToken,
      signIn,
      signUp,
      signOutUser,
    }),
    [user, loading, isAdmin, getIdToken, signIn, signUp, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
