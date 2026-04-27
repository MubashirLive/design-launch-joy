import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Sun } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({
  children,
  title,
  right,
}: {
  children: ReactNode;
  title?: string;
  right?: ReactNode;
}) {
  const { adminProfile, role, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sun className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold">Summer Camp 2026</div>
              <div className="text-[11px] text-muted-foreground">
                {role === "super_admin" ? "Super Admin" : adminProfile?.admin_id || "Admin"}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {right}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {title && <h1 className="mb-4 text-2xl font-bold tracking-tight">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
