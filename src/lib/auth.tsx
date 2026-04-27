import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type Role = "super_admin" | "admin" | null;

export interface AdminProfile {
  id: string;
  user_id: string;
  admin_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  forms_filled_count: number;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  role: Role;
  adminProfile: AdminProfile | null;
  signInSuperAdmin: (email: string, password: string) => Promise<void>;
  signInAdmin: (adminId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function adminIdToEmail(adminId: string) {
  return `${adminId.toLowerCase()}@admins.camp.local`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);

  async function loadRoleAndProfile(s: Session | null) {
    if (!s) {
      setRole(null);
      setAdminProfile(null);
      return;
    }
    // fetch roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", s.user.id);
    const r: Role = roles?.some((x) => x.role === "super_admin")
      ? "super_admin"
      : roles?.some((x) => x.role === "admin")
        ? "admin"
        : null;
    setRole(r);

    if (r === "admin" || r === "super_admin") {
      const { data: prof } = await supabase
        .from("admins")
        .select("*")
        .eq("user_id", s.user.id)
        .maybeSingle();
      setAdminProfile(prof as AdminProfile | null);
    } else {
      setAdminProfile(null);
    }
  }

  useEffect(() => {
    // Set up listener FIRST, then check session
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      // defer fetch to avoid recursion
      setTimeout(() => {
        loadRoleAndProfile(s);
      }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadRoleAndProfile(data.session).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInSuperAdmin(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Invalid ID or password");
  }
  async function signInAdmin(adminId: string, password: string) {
    const email = adminIdToEmail(adminId);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Invalid ID or password");
  }
  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setRole(null);
    setAdminProfile(null);
  }
  async function refreshProfile() {
    await loadRoleAndProfile(session);
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        role,
        adminProfile,
        signInSuperAdmin,
        signInAdmin,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
