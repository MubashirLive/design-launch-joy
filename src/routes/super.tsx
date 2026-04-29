import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  FilePlus2,
  Users,
  Download,
  Loader2,
  Filter,
  X,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CLASSES, EVENING_ACTIVITIES, MORNING_ACTIVITIES, fmtINR } from "@/lib/camp";

export const Route = createFileRoute("/super")({
  component: SuperHome,
});

// ─── types ────────────────────────────────────────────────────────────────────

interface AdminRow {
  id: string;
  user_id: string;
  admin_id: string;
  full_name: string;
  email: string;
}

interface Enrollment {
  id: string;
  student_name: string;
  age: number;
  gender: string;
  class: string;
  shift: "MORNING" | "EVENING";
  payment_mode: "CASH" | "ONLINE";
  transaction_id: string | null;
  total_amount: number;
  enrolled_at: string;
  enrolled_by: string;
  receipt_number: string | null;
  registration_number: number | null;
  registration_id: string | null;
  activities: { activity_name: string; fee: number }[];
  mess_opted: boolean;
  transport_opted: boolean;
  photo_url: string | null;
  marksheet_url: string | null;
  admin_name?: string;
  admin_id_label?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTIVITY_OPTIONS = Array.from(
  new Set([...MORNING_ACTIVITIES, ...EVENING_ACTIVITIES].map((a) => a.name)),
);
const AGE_OPTIONS = Array.from({ length: 19 }, (_, i) => i + 2);

function hasActivity(enrollment: Enrollment, activity: string) {
  return enrollment.activities?.some((a) => a.activity_name === activity) ?? false;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join(
    "\n",
  );
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function SuperHome() {
  const { loading, role, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session || role !== "super_admin") navigate({ to: "/login" });
  }, [loading, role, session, navigate]);

  // admins for filter dropdown
  const [admins, setAdmins] = useState<AdminRow[]>([]);

  // enrollments
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // filters
  const [filterAdmin, setFilterAdmin] = useState("all");
  const [filterPayment, setFilterPayment] = useState<"all" | "CASH" | "ONLINE">("all");
  const [filterShift, setFilterShift] = useState<"all" | "MORNING" | "EVENING">("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterAge, setFilterAge] = useState("all");
  const [filterActivity, setFilterActivity] = useState("all");
  const [filterMess, setFilterMess] = useState("all");
  const [filterTransport, setFilterTransport] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // load admins once
  useEffect(() => {
    if (role !== "super_admin") return;
    supabase
      .from("admins")
      .select("id,user_id,admin_id,full_name,email")
      .then(({ data }) => setAdmins((data as AdminRow[]) || []));
  }, [role]);

  // load enrollments when filters or admins change
  const fetchEnrollments = useCallback(async () => {
    setEnrollmentsLoading(true);
    try {
      let query = supabase
        .from("enrollments")
        .select(
          "id,student_name,age,gender,class,shift,payment_mode,transaction_id,total_amount,enrolled_at,enrolled_by,receipt_number,registration_number,registration_id,activities,mess_opted,transport_opted,photo_url,marksheet_url",
        )
        .order("enrolled_at", { ascending: false })
        .limit(200);

      if (filterPayment !== "all") query = query.eq("payment_mode", filterPayment);
      if (filterShift !== "all") query = query.eq("shift", filterShift);
      if (filterGender !== "all") query = query.eq("gender", filterGender);
      if (filterAge !== "all") query = query.eq("age", Number(filterAge));
      if (filterMess !== "all") query = query.eq("mess_opted", filterMess === "mess");
      if (filterTransport !== "all") {
        query = query.eq("transport_opted", filterTransport === "transport");
      }
      if (filterClass !== "all") query = query.eq("class", filterClass);
      if (filterFrom) query = query.gte("enrolled_at", filterFrom);
      if (filterTo) {
        const toEnd = new Date(filterTo);
        toEnd.setDate(toEnd.getDate() + 1);
        query = query.lt("enrolled_at", toEnd.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      let rows: Enrollment[] = (data ?? []).map((e) => {
        const adm = admins.find((a) => a.user_id === e.enrolled_by);
        return { ...e, admin_name: adm?.full_name ?? "—", admin_id_label: adm?.admin_id ?? "—" };
      });

      if (filterAdmin !== "all") {
        const adm = admins.find((a) => a.id === filterAdmin);
        rows = rows.filter((r) => r.enrolled_by === adm?.user_id);
      }
      if (filterActivity !== "all") {
        rows = rows.filter((r) => hasActivity(r, filterActivity));
      }

      setEnrollments(rows);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setEnrollmentsLoading(false);
  }, [
    admins,
    filterAdmin,
    filterPayment,
    filterShift,
    filterGender,
    filterAge,
    filterActivity,
    filterMess,
    filterTransport,
    filterClass,
    filterFrom,
    filterTo,
  ]);

  useEffect(() => {
    if (role === "super_admin") fetchEnrollments();
  }, [fetchEnrollments, role]);

  // export
  async function handleExport() {
    setExportBusy(true);
    try {
      let query = supabase
        .from("enrollments")
        .select("*")
        .order("enrolled_at", { ascending: false });
      if (filterPayment !== "all") query = query.eq("payment_mode", filterPayment);
      if (filterShift !== "all") query = query.eq("shift", filterShift);
      if (filterGender !== "all") query = query.eq("gender", filterGender);
      if (filterAge !== "all") query = query.eq("age", Number(filterAge));
      if (filterMess !== "all") query = query.eq("mess_opted", filterMess === "mess");
      if (filterTransport !== "all") {
        query = query.eq("transport_opted", filterTransport === "transport");
      }
      if (filterClass !== "all") query = query.eq("class", filterClass);
      if (filterFrom) query = query.gte("enrolled_at", filterFrom);
      if (filterTo) {
        const toEnd = new Date(filterTo);
        toEnd.setDate(toEnd.getDate() + 1);
        query = query.lt("enrolled_at", toEnd.toISOString().split("T")[0]);
      }
      const { data, error } = await query;
      if (error) throw error;

      const adminMap = Object.fromEntries(admins.map((a) => [a.user_id, a]));
      let rows = (data ?? []).map((e) => {
        const adm = adminMap[e.enrolled_by];
        return {
          Registration_No: e.registration_number ?? "",
          Registration_ID: e.registration_id ?? "",
          Receipt_Number: e.receipt_number ?? "",
          Student_Name: e.student_name,
          Class: e.class,
          School: e.school_name,
          DOB: e.date_of_birth,
          Age: e.age,
          Gender: e.gender,
          Email: e.email,
          Father_Name: e.father_name,
          Father_Contact: e.father_contact,
          Mother_Name: e.mother_name ?? "",
          Mother_Contact: e.mother_contact ?? "",
          Emergency_Contact: e.emergency_contact,
          Address: e.address,
          City: e.city,
          Shift: e.shift,
          Mess_Opted: e.mess_opted ? "Yes" : "No",
          Mess_Fee: e.mess_fee,
          Transport_Opted: e.transport_opted ? "Yes" : "No",
          Transport_Fee: e.transport_fee,
          Transport_Address: e.transport_address ?? "",
          Activities: JSON.stringify(e.activities),
          Combo_Applied: e.combo_applied ? "Yes" : "No",
          Combo_Discount: e.combo_discount,
          Total_Amount: e.total_amount,
          Payment_Mode: e.payment_mode,
          Transaction_ID: e.transaction_id ?? "",
          Allergies: e.allergies_medications ?? "",
          Remarks: e.remarks ?? "",
          Photo_URL: e.photo_url ?? "",
          Marksheet_URL: e.marksheet_url ?? "",
          Enrolled_By: adm?.full_name ?? e.enrolled_by,
          Admin_ID: adm?.admin_id ?? "",
          Enrolled_At: fmtDateTime(e.enrolled_at),
        };
      });

      if (filterAdmin !== "all") {
        const adm = admins.find((a) => a.id === filterAdmin);
        rows = rows.filter((r) => r.Enrolled_By === adm?.full_name);
      }
      if (filterActivity !== "all") {
        rows = rows.filter((r) => String(r.Activities).includes(`"activity_name":"${filterActivity}"`));
      }

      downloadCSV(`enrollments_${new Date().toISOString().split("T")[0]}.csv`, toCSV(rows));
      toast.success(`Exported ${rows.length} records`);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setExportBusy(false);
  }

  function clearFilters() {
    setFilterAdmin("all");
    setFilterPayment("all");
    setFilterShift("all");
    setFilterGender("all");
    setFilterAge("all");
    setFilterActivity("all");
    setFilterMess("all");
    setFilterTransport("all");
    setFilterClass("all");
    setFilterFrom("");
    setFilterTo("");
  }

  async function handleDeleteEnrollment(enrollment: Enrollment) {
    setDeletingId(enrollment.id);
    try {
      const { error } = await supabase.from("enrollments").delete().eq("id", enrollment.id);
      if (error) throw error;
      toast.success(`Enrollment for ${enrollment.student_name} deleted`);
      // Refresh the list
      fetchEnrollments();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setDeletingId(null);
  }

  const hasFilters =
    filterAdmin !== "all" ||
    filterPayment !== "all" ||
    filterShift !== "all" ||
    filterGender !== "all" ||
    filterAge !== "all" ||
    filterActivity !== "all" ||
    filterMess !== "all" ||
    filterTransport !== "all" ||
    filterClass !== "all" ||
    filterFrom !== "" ||
    filterTo !== "";

  if (loading || role !== "super_admin") return null;

  return (
    <AppShell title="Super Admin Dashboard">
      <div className="space-y-6">
        {/* ── Original navigation cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashCard
            to="/analytics"
            icon={<BarChart3 className="h-6 w-6" />}
            title="Analytics"
            desc="Revenue, trends, leaderboard"
          />
          <DashCard
            to="/admins"
            icon={<Users className="h-6 w-6" />}
            title="Manage Admins"
            desc="Create, edit, reset, disable"
          />
          <DashCard
            to="/enroll"
            icon={<FilePlus2 className="h-6 w-6" />}
            title="New Enrollment"
            desc="Fill a new student form"
          />
        </div>

        {/* ── Recent Enrollments ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base">Recent Enrollments</CardTitle>
              <Button
                onClick={handleExport}
                disabled={exportBusy}
                size="sm"
                variant="outline"
                className="gap-1.5 self-start sm:self-auto"
              >
                {exportBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </Button>
            </div>
          </CardHeader>

          {/* Filters */}
          <div className="px-4 pb-4 border-b">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filters
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-1 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" /> Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Select value={filterAdmin} onValueChange={setFilterAdmin}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Admins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Admins</SelectItem>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} ({a.admin_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Payments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cash & Online</SelectItem>
                  <SelectItem value="CASH">Cash only</SelectItem>
                  <SelectItem value="ONLINE">Online only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Shifts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="MORNING">Morning</SelectItem>
                  <SelectItem value="EVENING">Evening</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="Girl">Girls</SelectItem>
                  <SelectItem value="Boy">Boys</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterAge} onValueChange={setFilterAge}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Ages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ages</SelectItem>
                  {AGE_OPTIONS.map((age) => (
                    <SelectItem key={age} value={String(age)}>
                      {age} years
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterActivity} onValueChange={setFilterActivity}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Activities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  {ACTIVITY_OPTIONS.map((activity) => (
                    <SelectItem key={activity} value={activity}>
                      {activity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterMess} onValueChange={setFilterMess}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Mess" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mess & Non Mess</SelectItem>
                  <SelectItem value="mess">Mess</SelectItem>
                  <SelectItem value="non_mess">Non Mess</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterTransport} onValueChange={setFilterTransport}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Transport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Transport & Non Transport</SelectItem>
                  <SelectItem value="transport">Transport</SelectItem>
                  <SelectItem value="non_transport">Non Transport</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {CLASSES.map((klass) => (
                    <SelectItem key={klass} value={klass}>
                      {klass}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground pl-0.5">From</label>
                <Input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground pl-0.5">To</label>
                <Input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Active filter chips */}
            {hasFilters && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filterAdmin !== "all" && (
                  <Chip
                    label={`Admin: ${admins.find((a) => a.id === filterAdmin)?.full_name}`}
                    onRemove={() => setFilterAdmin("all")}
                  />
                )}
                {filterPayment !== "all" && (
                  <Chip
                    label={`Payment: ${filterPayment}`}
                    onRemove={() => setFilterPayment("all")}
                  />
                )}
                {filterShift !== "all" && (
                  <Chip label={`Shift: ${filterShift}`} onRemove={() => setFilterShift("all")} />
                )}
                {filterGender !== "all" && (
                  <Chip
                    label={`Gender: ${filterGender}`}
                    onRemove={() => setFilterGender("all")}
                  />
                )}
                {filterAge !== "all" && (
                  <Chip label={`Age: ${filterAge}`} onRemove={() => setFilterAge("all")} />
                )}
                {filterActivity !== "all" && (
                  <Chip
                    label={`Activity: ${filterActivity}`}
                    onRemove={() => setFilterActivity("all")}
                  />
                )}
                {filterMess !== "all" && (
                  <Chip
                    label={filterMess === "mess" ? "Mess" : "Non Mess"}
                    onRemove={() => setFilterMess("all")}
                  />
                )}
                {filterTransport !== "all" && (
                  <Chip
                    label={filterTransport === "transport" ? "Transport" : "Non Transport"}
                    onRemove={() => setFilterTransport("all")}
                  />
                )}
                {filterClass !== "all" && (
                  <Chip label={`Class: ${filterClass}`} onRemove={() => setFilterClass("all")} />
                )}
                {filterFrom && (
                  <Chip label={`From: ${fmtDate(filterFrom)}`} onRemove={() => setFilterFrom("")} />
                )}
                {filterTo && (
                  <Chip label={`To: ${fmtDate(filterTo)}`} onRemove={() => setFilterTo("")} />
                )}
              </div>
            )}
          </div>

          {/* Table */}
          <CardContent className="p-0">
            {enrollmentsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No enrollments match the selected filters.
              </div>
            ) : (
              <>
                <div className="px-4 py-2 text-xs text-muted-foreground border-b">
                  Showing {enrollments.length} record{enrollments.length !== 1 ? "s" : ""}
                  {hasFilters ? " (filtered)" : ""}
                </div>
                <div className="overflow-hidden">
                  <table className="w-full table-fixed text-xs">
                    <colgroup>
                      <col className="w-[15%]" />
                      <col className="w-[14%]" />
                      <col className="w-[5%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[9%]" />
                      <col className="w-[12%]" />
                      <col className="w-[8%]" />
                      <col className="w-[13%]" />
                      <col className="w-[8%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-2 py-2">Registration No.</th>
                        <th className="px-2 py-2">Student</th>
                        <th className="px-2 py-2">Class</th>
                        <th className="px-2 py-2">Shift</th>
                        <th className="px-2 py-2">Payment</th>
                        <th className="px-2 py-2 text-right">Amount</th>
                        <th className="px-2 py-2">Enrolled By</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2 text-center">Actions</th>
                        <th className="px-2 py-2 text-center">Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="break-all px-2 py-2.5 font-mono text-[11px] text-muted-foreground">
                            {e.registration_number ?? "-"}
                          </td>
                          <td className="px-2 py-2.5 font-medium">
                            {e.student_name}
                          </td>
                          <td className="px-2 py-2.5">{e.class}</td>
                          <td className="px-2 py-2.5">
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${e.shift === "MORNING" ? "border-amber-400 text-amber-700 bg-amber-50" : "border-indigo-400 text-indigo-700 bg-indigo-50"}`}
                            >
                              {e.shift === "MORNING" ? "🌅 Morning" : "🌆 Evening"}
                            </Badge>
                          </td>
                          <td className="px-2 py-2.5">
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${e.payment_mode === "CASH" ? "border-green-400 text-green-700 bg-green-50" : "border-blue-400 text-blue-700 bg-blue-50"}`}
                            >
                              {e.payment_mode === "CASH" ? "💵 Cash" : "🔁 Online"}
                            </Badge>
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                            {fmtINR(e.total_amount)}
                          </td>
                          <td className="px-2 py-2.5 text-xs">
                            <span className="font-medium">{e.admin_name}</span>
                            {e.admin_id_label && e.admin_id_label !== "—" && (
                              <span className="block text-[10px] text-muted-foreground font-mono">
                                {e.admin_id_label}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-xs text-muted-foreground">
                            {fmtDate(e.enrolled_at)}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Link
                                to="/enroll"
                                search={{ edit: e.id }}
                                title="Edit submitted form"
                                aria-label="Edit submitted form"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-primary hover:bg-accent"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                              <Link
                                to="/receipt/$id"
                                params={{ id: e.id }}
                                title="Download receipt"
                                aria-label="Download receipt"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-primary hover:bg-accent"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Link>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={deletingId === e.id}
                                    title="Delete enrollment"
                                    aria-label="Delete enrollment"
                                  >
                                    {deletingId === e.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Enrollment?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the enrollment for{" "}
                                      <strong>{e.student_name}</strong>. This action cannot be
                                      undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                      onClick={() => handleDeleteEnrollment(e)}
                                    >
                                      Yes, delete enrollment
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {e.photo_url ? (
                                <a
                                  href={e.photo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View photo"
                                  className="text-muted-foreground hover:text-primary"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40">—</span>
                              )}
                              {e.marksheet_url ? (
                                <a
                                  href={e.marksheet_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View marksheet"
                                  className="text-muted-foreground hover:text-primary"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/40">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t px-4 py-2.5 flex justify-between items-center text-sm">
                  <span className="text-xs text-muted-foreground">Revenue (filtered)</span>
                  <span className="font-bold">
                    {fmtINR(enrollments.reduce((s, e) => s + e.total_amount, 0))}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DashCard({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-md transition-shadow border-2 hover:border-primary cursor-pointer h-full">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center">
            {icon}
          </div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Chip({ label, onRemove }: { label: string | undefined; onRemove: () => void }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-primary/60">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
