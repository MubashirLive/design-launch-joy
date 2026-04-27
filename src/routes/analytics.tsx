import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtINR, MORNING_ACTIVITIES, EVENING_ACTIVITIES } from "@/lib/camp";
import { Download, TrendingUp, Users, Wallet, FileText } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

interface Enrollment {
  id: string;
  receipt_number: string | null;
  registration_id: string | null;
  student_name: string;
  shift: "MORNING" | "EVENING";
  class: string;
  school_name: string;
  city: string;
  gender: string;
  total_amount: number;
  payment_mode: string;
  mess_opted: boolean;
  transport_opted: boolean;
  combo_applied: boolean;
  activities: { activity_name: string; fee: number }[];
  enrolled_by: string;
  enrolled_at: string;
}

interface AdminRow {
  user_id: string;
  admin_id: string;
  full_name: string;
}

type Range = "7d" | "30d" | "all";

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function AnalyticsPage() {
  const { loading, role, session } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [range, setRange] = useState<Range>("30d");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!session || role !== "super_admin") navigate({ to: "/login" });
  }, [loading, role, session, navigate]);

  useEffect(() => {
    if (!session || role !== "super_admin") return;
    setBusy(true);
    Promise.all([
      supabase
        .from("enrollments")
        .select("id,receipt_number,registration_id,student_name,shift,class,school_name,city,gender,total_amount,payment_mode,mess_opted,transport_opted,combo_applied,activities,enrolled_by,enrolled_at")
        .eq("is_draft", false)
        .order("enrolled_at", { ascending: false })
        .limit(5000),
      supabase.from("admins").select("user_id,admin_id,full_name"),
    ]).then(([e, a]) => {
      setRows((e.data as Enrollment[]) || []);
      setAdmins((a.data as AdminRow[]) || []);
      setBusy(false);
    });
  }, [session, role]);

  const filtered = useMemo(() => {
    if (range === "all") return rows;
    const days = range === "7d" ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return rows.filter((r) => new Date(r.enrolled_at).getTime() >= cutoff);
  }, [rows, range]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const revenue = filtered.reduce((s, r) => s + (r.total_amount || 0), 0);
    const cash = filtered.filter((r) => r.payment_mode === "CASH").reduce((s, r) => s + r.total_amount, 0);
    const online = revenue - cash;
    const morning = filtered.filter((r) => r.shift === "MORNING").length;
    const evening = total - morning;
    const mess = filtered.filter((r) => r.mess_opted).length;
    const transport = filtered.filter((r) => r.transport_opted).length;
    const combo = filtered.filter((r) => r.combo_applied).length;
    return { total, revenue, cash, online, morning, evening, mess, transport, combo };
  }, [filtered]);

  const byDay = useMemo(() => {
    const map = new Map<string, { date: string; enrollments: number; revenue: number }>();
    filtered.forEach((r) => {
      const d = new Date(r.enrolled_at).toISOString().slice(0, 10);
      const cur = map.get(d) || { date: d, enrollments: 0, revenue: 0 };
      cur.enrollments += 1;
      cur.revenue += r.total_amount || 0;
      map.set(d, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const byActivity = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      (r.activities || []).forEach((a) => {
        const key = `${a.activity_name} (${r.shift === "MORNING" ? "M" : "E"})`;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const byPayment = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => map.set(r.payment_mode, (map.get(r.payment_mode) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byClass = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => map.set(r.class || "—", (map.get(r.class || "—") || 0) + 1));
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const byAdmin = useMemo(() => {
    const map = new Map<string, { admin: string; forms: number; revenue: number }>();
    filtered.forEach((r) => {
      const a = admins.find((x) => x.user_id === r.enrolled_by);
      const label = a ? `${a.admin_id}` : "—";
      const cur = map.get(label) || { admin: label, forms: 0, revenue: 0 };
      cur.forms += 1;
      cur.revenue += r.total_amount || 0;
      map.set(label, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, admins]);

  // Slot utilization (capacity-agnostic — shows demand)
  const slotUtil = useMemo(() => {
    const morningSlots = MORNING_ACTIVITIES.length;
    const eveningSlots = EVENING_ACTIVITIES.length;
    const usedMorning = filtered.filter((r) => r.shift === "MORNING").reduce((s, r) => s + (r.activities?.length || 0), 0);
    const usedEvening = filtered.filter((r) => r.shift === "EVENING").reduce((s, r) => s + (r.activities?.length || 0), 0);
    return { morningSlots, eveningSlots, usedMorning, usedEvening };
  }, [filtered]);

  const exportCSV = () => {
    const headers = [
      "receipt_number", "registration_id", "student_name", "shift", "class",
      "school_name", "city", "gender", "activities", "mess", "transport",
      "combo", "payment_mode", "total_amount", "enrolled_by_admin", "enrolled_at",
    ];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      const a = admins.find((x) => x.user_id === r.enrolled_by);
      const acts = (r.activities || []).map((x) => x.activity_name).join("; ");
      const row = [
        r.receipt_number || "",
        r.registration_id || "",
        r.student_name,
        r.shift,
        r.class,
        r.school_name,
        r.city,
        r.gender,
        acts,
        r.mess_opted ? "Y" : "N",
        r.transport_opted ? "Y" : "N",
        r.combo_applied ? "Y" : "N",
        r.payment_mode,
        r.total_amount,
        a?.admin_id || "",
        r.enrolled_at,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enrollments_${range}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || role !== "super_admin") return null;

  return (
    <AppShell
      title="Analytics"
      right={
        <Link to="/super">
          <Button variant="ghost" size="sm">Back</Button>
        </Link>
      }
    >
      {/* Range + export */}
      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="inline-flex rounded-lg border bg-card p-1">
          {(["7d", "30d", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "All time"}
            </button>
          ))}
        </div>
        <Button onClick={exportCSV} size="sm" variant="outline" disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {busy ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi icon={<FileText className="h-4 w-4" />} label="Enrollments" value={stats.total.toString()} />
            <Kpi icon={<Wallet className="h-4 w-4" />} label="Revenue" value={fmtINR(stats.revenue)} />
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Cash / Online" value={`${fmtINR(stats.cash)} / ${fmtINR(stats.online)}`} small />
            <Kpi icon={<Users className="h-4 w-4" />} label="Morning / Evening" value={`${stats.morning} / ${stats.evening}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
            <MiniStat label="Mess opted" value={stats.mess} total={stats.total} />
            <MiniStat label="Transport opted" value={stats.transport} total={stats.total} />
            <MiniStat label="Combo applied" value={stats.combo} total={stats.total} />
          </div>

          {/* Trend */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Enrollments & revenue over time</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="l" type="monotone" dataKey="enrollments" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line yAxisId="r" type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Activity popularity</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byActivity} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Payment mode</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byPayment} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Enrollments by class</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byClass}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Slot demand */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">Slot demand</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Total activity slots booked across all enrollments.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Morning slots booked</div>
                  <div className="text-2xl font-bold">{slotUtil.usedMorning}</div>
                  <div className="text-xs text-muted-foreground">across {slotUtil.morningSlots} activities</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Evening slots booked</div>
                  <div className="text-2xl font-bold">{slotUtil.usedEvening}</div>
                  <div className="text-xs text-muted-foreground">across {slotUtil.eveningSlots} activities</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin leaderboard */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="p-4 pb-2">
                <h3 className="font-semibold">Admin performance</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium">Admin ID</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Forms</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byAdmin.length === 0 && (
                    <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No data.</td></tr>
                  )}
                  {byAdmin.map((a) => (
                    <tr key={a.admin} className="border-t">
                      <td className="px-3 py-2 font-mono">{a.admin}</td>
                      <td className="px-3 py-2 text-right">{a.forms}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtINR(a.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}

function Kpi({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </div>
        <div className={`mt-1 font-bold ${small ? "text-base" : "text-2xl"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">/ {total} ({pct}%)</div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}
