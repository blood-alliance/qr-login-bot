import { ReactNode, createContext, useContext } from "react";

// Single-user mode: no real authentication. All data is keyed under a
// fixed shared "user_id" so existing per-user queries keep working.
export const SHARED_USER_ID = "00000000-0000-0000-0000-000000000000";

type SharedUser = { id: string; email: string };

type AuthCtx = {
  user: SharedUser;
  session: null;
  loading: false;
  signOut: () => Promise<void>;
};

const sharedUser: SharedUser = { id: SHARED_USER_ID, email: "shared@bot.local" };

const Ctx = createContext<AuthCtx>({
  user: sharedUser,
  session: null,
  loading: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={{ user: sharedUser, session: null, loading: false, signOut: async () => {} }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
