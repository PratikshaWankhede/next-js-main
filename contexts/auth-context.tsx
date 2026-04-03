"use client";

import { User } from "@/lib/types";
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  SessionProvider,
  getSession,
  signIn,
  signOut,
  useSession,
} from "next-auth/react";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthProviderInner>{children}</AuthProviderInner>
    </SessionProvider>
  );
}

function AuthProviderInner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  useEffect(() => {
    const syncUser = async () => {
      if (!session?.user?.id) {
        setUser(null);
        return;
      }

      const roleFromSession =
        typeof (session.user as { role?: unknown }).role === "string"
          ? ((session.user as { role: string }).role as User["role"])
          : undefined;

      let role = roleFromSession ?? "sales";
      if (!roleFromSession) {
        try {
          const res = await fetch("/api/me");
          if (res.ok) {
            const data = (await res.json()) as { role?: string };
            role = (data.role as User["role"]) ?? "sales";
          }
        } catch {
          // ignore; default role already set
        }
      }

      setUser({
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        avatar: session.user.image ?? "",
        role,
      });
    };

    void syncUser();
  }, [session]);

  const login = async (email: string, password: string) => {
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!res || res.error) {
      throw new Error(res?.error || "Failed to sign in");
    }

    // Ensure we immediately reflect auth state post-login.
    const newSession = await getSession();
    if (newSession?.user?.id) {
      const roleFromSession =
        typeof (newSession.user as { role?: unknown }).role === "string"
          ? ((newSession.user as { role: string }).role as User["role"])
          : "sales";
      setUser({
        id: newSession.user.id,
        name: newSession.user.name ?? "",
        email: newSession.user.email ?? "",
        avatar: newSession.user.image ?? "",
        role: roleFromSession ?? "sales",
      });
    }
  };

  const logout = async () => {
    try {
      await signOut({ redirect: false });
      setUser(null);
    } catch {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
