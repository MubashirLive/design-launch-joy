import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2, Sun } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signInSuperAdmin, signInAdmin, session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"sa" | "admin">("admin");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);
  const [bootstrapMode, setBootstrapMode] = useState(false);

  // SA fields
  const [saEmail, setSaEmail] = useState("");
  const [saPwd, setSaPwd] = useState("");
  // Admin fields
  const [adminId, setAdminId] = useState("");
  const [adminPwd, setAdminPwd] = useState("");
  // Bootstrap fields
  const [bsEmail, setBsEmail] = useState("");
  const [bsPwd, setBsPwd] = useState("");

  useEffect(() => {
    fetch("/api/public/bootstrap")
      .then((r) => r.json())
      .then((d) => setNeedsBootstrap(!!d.needsBootstrap))
      .catch(() => setNeedsBootstrap(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (session && role === "super_admin") navigate({ to: "/super" });
    else if (session && role === "admin") navigate({ to: "/dashboard" });
  }, [loading, session, role, navigate]);

  async function handleSA(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInSuperAdmin(saEmail.trim(), saPwd);
      toast.success("Welcome back");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function handleAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInAdmin(adminId.trim().toUpperCase(), adminPwd);
      toast.success("Signed in");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    if (bsPwd.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/public/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: bsEmail.trim(), password: bsPwd }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success("Super admin created. Please log in.");
      setNeedsBootstrap(false);
      setBootstrapMode(false);
      setSaEmail(bsEmail.trim());
      setTab("sa");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-soft via-background to-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center rounded-2xl ">
            <img src="src\assets\logo.png" alt="Logo" className="h-36 w-36" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Ideal International School</h1>
          <p className="text-sm text-muted-foreground">Enrollment & Receipt Portal</p>
        </div>

        {bootstrapMode ? (
          <Card>
            <CardHeader>
              <CardTitle>Create Super Admin</CardTitle>
              <p className="text-xs text-muted-foreground">
                One-time setup. This account manages all admins and enrollments.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBootstrap} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bse">Email</Label>
                  <Input id="bse" type="email" required value={bsEmail} onChange={(e) => setBsEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bsp">Password (min 8 chars)</Label>
                  <Input id="bsp" type="password" required value={bsPwd} onChange={(e) => setBsPwd(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Super Admin
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v as "sa" | "admin")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sa">Super Admin</TabsTrigger>
                  <TabsTrigger value="admin">Admin</TabsTrigger>
                </TabsList>

                <TabsContent value="sa" className="mt-4">
                  <form onSubmit={handleSA} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sae">Email</Label>
                      <Input id="sae" type="email" required value={saEmail} onChange={(e) => setSaEmail(e.target.value)} autoComplete="email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sap">Password</Label>
                      <PasswordInput id="sap" value={saPwd} onChange={setSaPwd} show={show} setShow={setShow} />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign in as Super Admin
                    </Button>
                  </form>
                  {needsBootstrap && (
                    <button
                      type="button"
                      onClick={() => setBootstrapMode(true)}
                      className="mt-4 w-full text-xs text-primary hover:underline"
                    >
                      First time? Create the Super Admin account
                    </button>
                  )}
                </TabsContent>

                <TabsContent value="admin" className="mt-4">
                  <form onSubmit={handleAdmin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="aid">Admin ID</Label>
                      <Input id="aid" required value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="e.g. PRI001" autoComplete="username" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apw">Password</Label>
                      <PasswordInput id="apw" value={adminPwd} onChange={setAdminPwd} show={show} setShow={setShow} />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign in
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Forgot password? Contact the Super Admin to reset it.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PasswordInput(props: {
  id: string; value: string; onChange: (v: string) => void; show: boolean; setShow: (b: boolean) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={props.id}
        type={props.show ? "text" : "password"}
        required
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        onClick={() => props.setShow(!props.show)}
        aria-label={props.show ? "Hide password" : "Show password"}
      >
        {props.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
