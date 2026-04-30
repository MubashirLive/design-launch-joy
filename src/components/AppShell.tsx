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
import { Eye, EyeOff, LogOut, Loader2, Settings } from "lucide-react";
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
  const { role, session, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"password" | "email-otp" | "email-change" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [confirmEmailPassword, setConfirmEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showConfirmEmailPassword, setShowConfirmEmailPassword] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const navigate = useNavigate();

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

  async function sendEmailChangeOtp() {
    const currentEmail = session?.user.email;
    if (!currentEmail) {
      toast.error("Current email is not available");
      return;
    }
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid new email address");
      return;
    }
    if (email === currentEmail.toLowerCase()) {
      toast.error("Enter a different email address");
      return;
    }

    setBusy("email-otp");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: currentEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setEmailOtpSent(true);
      toast.success("OTP sent to your old email");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function confirmEmailChange(e: React.FormEvent) {
    e.preventDefault();
    const currentEmail = session?.user.email?.toLowerCase();
    const email = newEmail.trim().toLowerCase();
    if (!currentEmail) {
      toast.error("Current email is not available");
      return;
    }
    if (!emailOtp.trim()) {
      toast.error("Enter the OTP sent to your old email");
      return;
    }
    if (emailPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (emailPassword !== confirmEmailPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setBusy("email-change");
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!currentSession?.access_token) throw new Error("Please log in again");

      const response = await fetch("/api/account/change-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          currentEmail,
          email,
          otp: emailOtp.trim(),
          password: emailPassword,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Unable to change email");
      }

      toast.success("Mail is changed");
      await signOut();
      navigate({ to: "/login" });
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
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>
            Update your password or start a secure login email change.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={updatePassword} className="space-y-2.5 border-b pb-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword((show) => !show)}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword((show) => !show)}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={!!busy}>
            {busy === "password" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>

        {role === "super_admin" && (
          <form onSubmit={confirmEmailChange} className="space-y-2.5">
            <div className="space-y-1">
              <Label>Login email</Label>
              <p className="rounded-md border bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                {session?.user.email || "No email found"}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1">
                <Label htmlFor="change-email-new">New mail</Label>
                <Input
                  id="change-email-new"
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailOtpSent(false);
                  }}
                  autoComplete="email"
                  required
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!!busy || !newEmail.trim()}
                onClick={sendEmailChangeOtp}
              >
                {busy === "email-otp" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP
              </Button>
            </div>
            {emailOtpSent && (
              <p className="text-xs text-muted-foreground">
                OTP sent to {session?.user.email}. Enter it below to confirm the change.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="change-email-otp">OTP from old email</Label>
                <Input
                  id="change-email-otp"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="change-email-password">New password</Label>
                <div className="relative">
                  <Input
                    id="change-email-password"
                    type={showEmailPassword ? "text" : "password"}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowEmailPassword((show) => !show)}
                    aria-label={showEmailPassword ? "Hide new password" : "Show new password"}
                  >
                    {showEmailPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="change-email-confirm-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="change-email-confirm-password"
                  type={showConfirmEmailPassword ? "text" : "password"}
                  value={confirmEmailPassword}
                  onChange={(e) => setConfirmEmailPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmEmailPassword((show) => !show)}
                  aria-label={
                    showConfirmEmailPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirmEmailPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              className="w-full"
              disabled={!!busy || !emailOtpSent || !emailOtp.trim()}
            >
              {busy === "email-change" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Mail Change
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
