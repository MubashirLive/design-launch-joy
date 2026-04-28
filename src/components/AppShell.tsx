import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Loader2, Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import Logo from '../assets/logo.png'

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
            <div className="inline-flex items-center justify-center rounded-2xl ">
              <img src={Logo} alt="Logo" className="h-14 w-14" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Ideal International School, Indore</div>
              <div className="text-[11px] text-muted-foreground">
                {role === "super_admin" ? "Super Admin" : adminProfile?.admin_id || "Admin"}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {right}
            <AccountSettingsDialog />
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

function AccountSettingsDialog() {
  const { role, session, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"password" | "email-link" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy("password");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function sendEmailChangeLink() {
    const currentEmail = session?.user.email;
    if (!currentEmail) {
      toast.error("Current email is not available");
      return;
    }
    setBusy("email-link");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
        redirectTo: `${window.location.origin}/change-email`,
      });
      if (error) throw error;
      await refreshProfile();
      toast.success("Password change link sent to your current email");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account settings" title="Account settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>
            Update your password or start a secure login email change.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={updatePassword} className="space-y-3 border-b pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={!!busy}>
            {busy === "password" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>

        {role === "super_admin" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Login email</Label>
              <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {session?.user.email || "No email found"}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!!busy}
              onClick={sendEmailChangeLink}
            >
              {busy === "email-link" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Password Change Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
