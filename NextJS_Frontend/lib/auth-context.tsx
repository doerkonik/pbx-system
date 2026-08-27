"use client";

/**
 * Authentication context: provides the current user, login/logout, and a
 * loading flag while the persisted session is rehydrated. Also exports
 * `useRequireAuth` to guard client routes by role.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { post } from "./api";
import {
  clearSession,
  getStoredUser,
  setSession,
} from "./auth-storage";
import { disconnectSocket, refreshSocketAuth } from "./ws";
import {
  isTwoFactorChallenge,
  type AuthUser,
  type LoginResponse,
  type LoginResult,
  type UserRole,
} from "./types";

/** Home route for a role: agents get the agent console, staff the admin one. */
export function homeForRole(role: UserRole): string {
  return role === "agent" ? "/agent" : "/admin";
}

/** True when a user's role satisfies a required role (supervisor ⊇ admin views). */
export function roleSatisfies(actual: UserRole, required: UserRole): boolean {
  if (actual === required) return true;
  // Supervisors may reach admin-section routes (endpoints still gate per-action).
  return required === "admin" && actual === "supervisor";
}

/** Result of a login attempt: completed, or a pending 2FA challenge. */
export type LoginOutcome =
  | { status: "ok"; user: AuthUser }
  | { status: "2fa"; mfaToken: string };

export interface AuthContextValue {
  user: AuthUser | null;
  /** True while rehydrating the session on first mount. */
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<LoginOutcome>;
  /** Complete a 2FA login with the authenticator code. */
  verifyTwoFactor: (mfaToken: string, code: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate persisted session once on mount.
  useEffect(() => {
    setUser(getStoredUser());
    setLoading(false);
  }, []);

  const applyLogin = useCallback((res: LoginResponse): AuthUser => {
    setSession({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
    });
    setUser(res.user);
    refreshSocketAuth();
    return res.user;
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginOutcome> => {
      const res = await post<LoginResult>(
        "/auth/login",
        { username, password },
        { skipAuth: true },
      );
      if (isTwoFactorChallenge(res)) {
        return { status: "2fa", mfaToken: res.mfaToken };
      }
      return { status: "ok", user: applyLogin(res) };
    },
    [applyLogin],
  );

  const verifyTwoFactor = useCallback(
    async (mfaToken: string, code: string): Promise<AuthUser> => {
      const res = await post<LoginResponse>(
        "/auth/2fa/verify",
        { mfaToken, code },
        { skipAuth: true },
      );
      return applyLogin(res);
    },
    [applyLogin],
  );

  const logout = useCallback(() => {
    // Best-effort server-side revoke; ignore failures.
    post("/auth/logout").catch(() => undefined);
    clearSession();
    disconnectSocket();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      verifyTwoFactor,
      logout,
    }),
    [user, loading, login, verifyTwoFactor, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}

/**
 * Client-side route guard. Redirects unauthenticated users to /login and
 * (optionally) enforces a required role, sending mismatched users to their
 * own home. Returns the resolved user (or null while loading/redirecting).
 */
export function useRequireAuth(requiredRole?: UserRole): {
  user: AuthUser | null;
  loading: boolean;
} {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requiredRole && !roleSatisfies(user.role, requiredRole)) {
      router.replace(homeForRole(user.role));
    }
  }, [user, loading, requiredRole, router]);

  const authorized =
    !!user && (!requiredRole || roleSatisfies(user.role, requiredRole));

  return { user: authorized ? user : null, loading };
}
