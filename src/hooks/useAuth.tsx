import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, AppUser } from "@/lib/api";

// ── Context shape ──────────────────────────────────────────────────────────────
interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  setUser: (u: AppUser | null) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  setUser: () => {},
  signOut: () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount: restore user from localStorage, then verify token is still valid
    const stored = api.auth.getStoredUser();
    if (stored) {
      api.auth.me().then(({ data, error }) => {
        if (data && !error) {
          setUser(stored);
        } else {
          // Token expired or invalid — clear session
          api.auth.signOut();
          setUser(null);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const signOut = () => {
    api.auth.signOut();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, setUser, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export const useAuth = () => useContext(Ctx);
