"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./client";
import { useAuth } from "@/lib/firebase/AuthProvider";

/**
 * Fetches something that needs the signed-in admin's ID token, the moment
 * that token is actually available — not before. `AdminGuard` above these
 * pages in the tree means `user`/`isAdmin` are already true by the time this
 * runs, but the token itself is fetched asynchronously.
 */
export function useAdminQuery<T>(fetcher: (idToken: string) => Promise<T>) {
  const { getIdToken } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setError("Sign in again to see this.");
        return;
      }
      setData(await fetcher(token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load that.");
    } finally {
      setLoading(false);
    }
    // fetcher is expected to be referentially stable (module-level function).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
