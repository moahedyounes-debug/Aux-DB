import { useEffect, useState, useCallback } from "react";

export type AccessRecord = {
  email: string;
  asc: string;
  branch: string;
  isAdmin: boolean;
  parts: string;
  callCenter: boolean;
  isAllAccess: boolean;
  role: string;
  /** Explicit page whitelist. Empty = old behaviour (all pages, filtered by ASC/branch on the data itself). */
  allowedPages: string[];
  savedAt?: number;
};

const STORAGE_KEY = "aux_access";

function readAccess(): AccessRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AccessRecord;
  } catch {
    return null;
  }
}

export function clearAccess() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function saveAccess(access: AccessRecord, remember = true) {
  if (typeof window === "undefined") return;
  const record = { ...access, savedAt: Date.now() };
  const storage = remember ? window.localStorage : window.sessionStorage;
  const otherStorage = remember ? window.sessionStorage : window.localStorage;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(record));
    otherStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Client-side access hook. Reads the session persisted by the standalone
 * login page (index.html) from localStorage/sessionStorage.
 * `ready` becomes true after hydration so SSR renders don't flicker.
 */
export function useAccess() {
  const [access, setAccess] = useState<AccessRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccess(readAccess());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setAccess(readAccess());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signOut = useCallback(() => {
    clearAccess();
    setAccess(null);
  }, []);

  const signIn = useCallback((record: AccessRecord, remember = true) => {
    saveAccess(record, remember);
    setAccess({ ...record, savedAt: Date.now() });
  }, []);

  return { access, ready, signIn, signOut };
}

/**
 * Returns true if the user is allowed to see the given page path.
 * Rules:
 *  - Admin / all-access → every page.
 *  - allowedPages empty → every page (back-compat with old Access rows).
 *  - Otherwise → path must be in allowedPages.
 */
export function hasPageAccess(access: AccessRecord | null, path: string): boolean {
  if (!access) return false;
  if (access.isAdmin || access.isAllAccess) return true;
  const pages = access.allowedPages ?? [];
  if (pages.length === 0) return true;
  if (pages.includes("all")) return true;
  return pages.includes(path);
}

/**
 * Filter a row list by the current user's access.
 * - `isAllAccess` sees everything.
 * - Otherwise: match on ASC (company). If a branch is set and does NOT
 *   look like a call-center bucket ("... CC" / "Always CC"), narrow
 *   further to that branch.
 */
export function applyAccessFilter<T extends Record<string, unknown>>(
  rows: T[],
  access: AccessRecord | null,
  fields: { asc?: keyof T; branch?: keyof T } = {},
): T[] {
  if (!access || access.isAllAccess) return rows;
  const ascField = fields.asc ?? ("asc" as keyof T);
  const branchField = fields.branch ?? ("branch" as keyof T);
  const wantAsc = access.asc.toLowerCase();
  const wantBranch = access.branch.toLowerCase();
  const isCcBucket =
    wantBranch.endsWith(" cc") || wantBranch === "always cc";
  return rows.filter((row) => {
    const rowAsc = String(row[ascField] ?? "").toLowerCase();
    if (wantAsc && rowAsc && rowAsc !== wantAsc) return false;
    if (!isCcBucket && wantBranch) {
      const rowBranch = String(row[branchField] ?? "").toLowerCase();
      if (rowBranch && rowBranch !== wantBranch) return false;
    }
    return true;
  });
}