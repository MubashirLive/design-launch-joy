import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from '../assets/logo.png'

export const Route = createFileRoute("/change-email")({
  component: ChangeEmailPage,
});

function ChangeEmailPage() {
  const { loading, session, role, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [updatedEmail, setUpdatedEmail] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
  }, [loading, navigate, session]);

  async function confirmNewEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || email === session?.user.email?.toLowerCase()) {
      toast.error("Enter a new email address");
      return;
    }

    setBusy(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!currentSession?.access_token)
        throw new Error("Email change link has expired. Please request a new link.");

      const response = await fetch("/api/account/change-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { ok?: boolean; email?: string; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to change email");

      setUpdatedEmail(result.email || email);
      setNewEmail("");
      await supabase.auth.refreshSession();
      await refreshProfile();
      toast.success("Login email updated");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={Logo} alt="Logo" className="mx-auto h-24 w-24" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Change Login Email</h1>
          <p className="text-sm text-muted-foreground">Ideal International School, Indore</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Confirm New Email</CardTitle>
          </CardHeader>
          <CardContent>
            {updatedEmail ? (
              <div className="space-y-4">
                <p className="rounded-md border bg-muted px-3 py-2 text-sm">
                  Login email changed to <span className="font-medium">{updatedEmail}</span>.
                </p>
                <Button
                  className="w-full"
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/login" });
                  }}
                >
                  Sign in with New Email
                </Button>
              </div>
            ) : (
              <form onSubmit={confirmNewEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current email</Label>
                  <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-email">New email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {role !== "super_admin" && (
                  <p className="text-xs text-destructive">
                    Only the Super Admin login email can be changed here.
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={busy || role !== "super_admin"}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm New Email
                </Button>
              </form>
            )}

            <Link
              to="/super"
              className="mt-4 block text-center text-xs text-primary hover:underline"
            >
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
