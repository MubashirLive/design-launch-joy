import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admins")({
  component: AdminsPage,
});

interface AdminRow {
  id: string;
  user_id: string;
  admin_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  forms_filled_count: number;
}

function AdminsPage() {
  const { loading, role, session } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminRow | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session || role !== "super_admin") navigate({ to: "/login" });
  }, [loading, role, session, navigate]);

  useEffect(() => {
    if (role !== "super_admin") return;
    supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as AdminRow[]) || []));
  }, [role, reloadTick]);

  async function toggleActive(row: AdminRow) {
    const { error } = await supabase
      .from("admins")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${row.admin_id} ${!row.is_active ? "enabled" : "disabled"}`);
      setReloadTick((x) => x + 1);
    }
  }

  if (loading || role !== "super_admin") return null;

  return (
    <AppShell title="Manage Admins">
      <div className="flex justify-end mb-3">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Create Admin</Button>
          </DialogTrigger>
          <CreateAdminDialog onCreated={() => { setCreateOpen(false); setReloadTick((x) => x + 1); }} />
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <Th>Admin ID</Th><Th>Full Name</Th><Th>Email</Th><Th>Status</Th>
                <Th>Forms</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No admins yet.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <Td className="font-mono font-semibold">{r.admin_id}</Td>
                  <Td>{r.full_name}</Td>
                  <Td className="text-muted-foreground">{r.email}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                      <span className="text-xs">{r.is_active ? "Active" : "Disabled"}</span>
                    </div>
                  </Td>
                  <Td>{r.forms_filled_count}</Td>
                  <Td>
                    <Button size="sm" variant="outline" onClick={() => setResetTarget(r)}>
                      <KeyRound className="h-3 w-3 mr-1" /> Reset password
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    </AppShell>
  );
}

function CreateAdminDialog({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
          firstName: fullName.split(" ")[0],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success(`Created ${d.adminId}`);
      setFullName(""); setEmail(""); setPassword("");
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Admin</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Admin ID auto-generated from first name.</p>
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Initial Password</Label>
          <Input type="text" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ResetPasswordDialog({
  target, onClose,
}: { target: AdminRow | null; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPwd(""); }, [target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (pwd.length < 6) { toast.error("Min 6 chars"); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ adminId: target.admin_id, newPassword: pwd }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success("Password reset");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password — {target?.admin_id}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>New password</Label>
            <Input type="text" required value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="text-left text-xs font-medium px-3 py-2">{children}</th>
);
const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 ${className}`}>{children}</td>
);
