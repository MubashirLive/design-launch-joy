import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FilePlus2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtINR } from "@/lib/camp";

export const Route = createFileRoute("/dashboard")({
  component: AdminHome,
});

interface Row {
  id: string;
  receipt_number: string | null;
  registration_id: string | null;
  student_name: string;
  shift: string;
  total_amount: number;
  payment_mode: string;
  enrolled_at: string;
}

function AdminHome() {
  const { loading, role, session, adminProfile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session || role !== "admin") navigate({ to: "/login" });
  }, [loading, role, session, navigate]);

  useEffect(() => {
    if (!session || role !== "admin") return;
    supabase
      .from("enrollments")
      .select(
        "id,receipt_number,registration_id,student_name,shift,total_amount,payment_mode,enrolled_at",
      )
      .eq("is_draft", false)
      .order("enrolled_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as Row[]) || []));
  }, [session, role]);

  if (loading || role !== "admin") return null;

  const totals = rows.reduce(
    (acc, r) => {
      if (r.payment_mode === "CASH") acc.cash += r.total_amount;
      else acc.online += r.total_amount;
      return acc;
    },
    { cash: 0, online: 0 },
  );

  return (
    <AppShell title={`Welcome, ${adminProfile?.full_name?.split(" ")[0] || "Admin"}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Link to="/enroll">
          <Card className="hover:shadow-md transition-shadow border-2 hover:border-primary cursor-pointer h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center">
                <FilePlus2 className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">New Enrollment / Receipt</div>
                <div className="text-xs text-muted-foreground">Fill a student form</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs text-muted-foreground">My totals (last 50)</div>
            <div className="mt-1 text-sm">
              Forms: <b>{rows.length}</b> · Cash: <b>{fmtINR(totals.cash)}</b> · Online:{" "}
              <b>{fmtINR(totals.online)}</b>
            </div>
            <div className="mt-1 text-base font-semibold">
              Total: {fmtINR(totals.cash + totals.online)}
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-3">My Enrollments</h2>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <Th>Receipt</Th>
                <Th>Reg ID</Th>
                <Th>Student</Th>
                <Th>Shift</Th>
                <Th>Amount</Th>
                <Th>Mode</Th>
                <Th>Date</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    No enrollments yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <Td className="font-mono">{r.receipt_number}</Td>
                  <Td className="font-mono text-xs">{r.registration_id}</Td>
                  <Td>{r.student_name}</Td>
                  <Td>{r.shift === "MORNING" ? "Morning" : "Evening"}</Td>
                  <Td className="font-semibold">{fmtINR(r.total_amount)}</Td>
                  <Td>{r.payment_mode}</Td>
                  <Td className="text-xs">{new Date(r.enrolled_at).toLocaleString()}</Td>
                  <Td>
                    <ButtonLink to="/receipt/$id" params={{ id: r.id }} title="Download receipt">
                      <Download className="h-3.5 w-3.5" />
                    </ButtonLink>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="text-left text-xs font-medium px-3 py-2">{children}</th>
);
const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 ${className}`}>{children}</td>
);

function ButtonLink({
  to,
  params,
  title,
  children,
}: {
  to: "/receipt/$id";
  params: { id: string };
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      title={title}
      aria-label={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-primary hover:bg-accent"
    >
      {children}
    </Link>
  );
}
