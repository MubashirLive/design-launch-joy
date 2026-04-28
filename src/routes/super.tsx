import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Loader2,
  Download,
  Trash2,
  Users,
  ClipboardList,
  TrendingUp,
  Filter,
  X,
  ExternalLink,
} from "lucide-react";
import { fmtINR } from "@/lib/camp";

export const Route = createFileRoute("/super")({
  component: SuperAdminPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface Admin {
  id: string;
  admin_id: string;
  full_name: string;
  email: string;
  forms_filled_count: number;
  is_active: boolean;
  created_at: string;
}

interface Enrollment {
  id: string;
  student_name: string;
  class: string;
  shift: "MORNING" | "EVENING";
  payment_mode: "CASH" | "ONLINE";
  total_amount: number;
  enrolled_at: string;
  enrolled_by: string; // user_id
  receipt_number: string | null;
  registration_id: string | null;
  photo_url: string | null;
  marksheet_url: string | null;
  // joined
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

/** Convert array of objects to CSV string */
function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function SuperAdminPage() {
  const { loading, role, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session || role !== "super_admin") navigate({ to: "/login" });
  }, [loading, role, session, navigate]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({
    totalAdmins: 0,
    totalEnrollments: 0,
    totalRevenue: 0,
  });

  // ── Admins list ────────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Enrollments / Recent Forms ─────────────────────────────────────────────
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);

  // Filter state
  const [filterAdmin, setFilterAdmin] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterShift, setFilterShift] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // ── fetch admins ───────────────────────────────────────────────────────────
  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true);
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load admins");
    } else {
      setAdmins(data ?? []);
    }
    setAdminsLoading(false);
  }, []);

  // ── fetch enrollments with optional filters ────────────────────────────────
  const fetchEnrollments = useCallback(async () => {
    setEnrollmentsLoading(true);
    try {
      let query = supabase
        .from("enrollments")
        .select(
          "id,student_name,class,shift,payment_mode,total_amount,enrolled_at,enrolled_by,receipt_number,registration_id,photo_url,marksheet_url",
        )
        .order("enrolled_at", { ascending: false })
        .limit(200);

      if (filterPayment !== "all")
        query = query.eq("payment_mode", filterPayment);
      if (filterShift !== "all") query = query.eq("shift", filterShift);
      if (filterFrom) query = query.gte("enrolled_at", filterFrom);
      if (filterTo) {
        // include the whole "to" day
        const toEnd = new Date(filterTo);
        toEnd.setDate(toEnd.getDate() + 1);
        query = query.lt("enrolled_at", toEnd.toISOString().split("T")[0]);
      }

      const { data: rawEnrollments, error } = await query;
      if (error) throw error;

      // join admin names from local admins list
      const rows: Enrollment[] = (rawEnrollments ?? []).map((e) => {
        const admin = admins.find((a) => a.user_id === e.enrolled_by) as
          | (Admin & { user_id: string })
          | undefined;
        return {
          ...e,
          admin_name: admin?.full_name ?? "—",
          admin_id_label: admin?.admin_id ?? "—",
        };
      });

      // filter by admin after join
      const filtered =
        filterAdmin === "all"
          ? rows
          : rows.filter(
              (r) =>
                admins.find((a) => a.id === filterAdmin)?.email ===
                r.enrolled_by,
            );

      setEnrollments(filtered);

      // compute stats from full unfiltered data for summary cards
      const { data: allData } = await supabase
        .from("enrollments")
        .select("total_amount", { count: "exact" });
      setStats({
        totalAdmins: admins.length,
        totalEnrollments: allData?.length ?? 0,
        totalRevenue: (allData ?? []).reduce(
          (s, r) => s + (r.total_amount ?? 0),
          0,
        ),
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
    setEnrollmentsLoading(false);
  }, [admins, filterAdmin, filterPayment, filterShift, filterFrom, filterTo]);

  useEffect(() => {
    if (!session) return;
    fetchAdmins();
  }, [session]);

  useEffect(() => {
    if (!adminsLoading) fetchEnrollments();
  }, [adminsLoading, filterAdmin, filterPayment, filterShift, filterFrom, filterTo]);

  // ── delete admin ───────────────────────────────────────────────────────────
  async function handleDeleteAdmin(admin: Admin) {
    setDeletingId(admin.id);
    try {
      // 1. remove from admins table
      const { error: e1 } = await supabase
        .from("admins")
        .delete()
        .eq("id", admin.id);
      if (e1) throw e1;

      // 2. remove role so they can't log in as admin
      const { error: e2 } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", admin.user_id ?? "");
      if (e2) throw e2;

      toast.success(`Admin "${admin.full_name}" deleted`);
      await fetchAdmins();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setDeletingId(null);
  }

  // ── export CSV ─────────────────────────────────────────────────────────────
  async function handleExport() {
    setExportBusy(true);
    try {
      // Fetch ALL enrollments (no limit) for the export
      let query = supabase.from("enrollments").select("*").order("enrolled_at", { ascending: false });

      if (filterPayment !== "all") query = query.eq("payment_mode", filterPayment);
      if (filterShift !== "all") query = query.eq("shift", filterShift);
      if (filterFrom) query = query.gte("enrolled_at", filterFrom);
      if (filterTo) {
        const toEnd = new Date(filterTo);
        toEnd.setDate(toEnd.getDate() + 1);
        query = query.lt("enrolled_at", toEnd.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      const adminMap = Object.fromEntries(
        admins.map((a) => [a.user_id ?? "", a]),
      );

      const rows = (data ?? []).map((e) => {
        const adm = adminMap[e.enrolled_by];
        return {
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
          Allergies: e.allergies_medications ?? "",
          Remarks: e.remarks ?? "",
          Photo_URL: e.photo_url ?? "",
          Marksheet_URL: e.marksheet_url ?? "",
          Enrolled_By_Admin: adm?.full_name ?? e.enrolled_by,
          Admin_ID: adm?.admin_id ?? "",
          Enrolled_At: fmtDateTime(e.enrolled_at),
        };
      });

      // apply admin filter for export too
      const finalRows =
        filterAdmin === "all"
          ? rows
          : rows.filter((r) => {
              const a = admins.find((adm) => adm.id === filterAdmin);
              return a ? r.Enrolled_By_Admin === a.full_name : true;
            });

      const dateSuffix = new Date().toISOString().split("T")[0];
      downloadCSV(`enrollments_${dateSuffix}.csv`, toCSV(finalRows));
      toast.success(`Exported ${finalRows.length} records`);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setExportBusy(false);
  }

  // ── clear filters ──────────────────────────────────────────────────────────
  function clearFilters() {
    setFilterAdmin("all");
    setFilterPayment("all");
    setFilterShift("all");
    setFilterFrom("");
    setFilterTo("");
  }

  const hasActiveFilters =
    filterAdmin !== "all" ||
    filterPayment !== "all" ||
    filterShift !== "all" ||
    filterFrom !== "" ||
    filterTo !== "";

  if (loading || !session) return null;

  return (
    <AppShell title="Super Admin Dashboard">
      <div className="space-y-8">
        {/* ── Stats Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Admins"
            value={stats.totalAdmins}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            title="Total Enrollments"
            value={stats.totalEnrollments}
            icon={<ClipboardList className="h-5 w-5" />}
          />
          <StatCard
            title="Total Revenue"
            value={fmtINR(stats.totalRevenue)}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        {/* ── Manage Admins ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage Admins</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {adminsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : admins.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 pb-4">
                No admins found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-4 py-2">Admin ID</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2 text-center">Forms Filled</th>
                      <th className="px-4 py-2 text-center">Status</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr
                        key={admin.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {admin.admin_id}
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          {admin.full_name}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {admin.email}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {admin.forms_filled_count}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge
                            variant={
                              admin.is_active ? "default" : "secondary"
                            }
                            className="text-[11px]"
                          >
                            {admin.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {/* ── DELETE BUTTON ─────────────────────────── */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={deletingId === admin.id}
                              >
                                {deletingId === admin.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Admin?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove{" "}
                                  <strong>{admin.full_name}</strong> (
                                  {admin.admin_id}) and revoke their login
                                  access. Their past enrollment records will be
                                  kept. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  onClick={() => handleDeleteAdmin(admin)}
                                >
                                  Yes, delete admin
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Enrollments ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base">Recent Enrollments</CardTitle>

              {/* Export button */}
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

          {/* ── Filters ───────────────────────────────────────────────────── */}
          <div className="px-4 pb-4 border-b">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-1 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" /> Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {/* Admin filter */}
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

              {/* Payment mode filter */}
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

              {/* Shift filter */}
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

              {/* Date from */}
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground pl-0.5">
                  From
                </label>
                <Input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Date to */}
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground pl-0.5">
                  To
                </label>
                <Input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filterAdmin !== "all" && (
                  <FilterChip
                    label={`Admin: ${admins.find((a) => a.id === filterAdmin)?.full_name}`}
                    onRemove={() => setFilterAdmin("all")}
                  />
                )}
                {filterPayment !== "all" && (
                  <FilterChip
                    label={`Payment: ${filterPayment}`}
                    onRemove={() => setFilterPayment("all")}
                  />
                )}
                {filterShift !== "all" && (
                  <FilterChip
                    label={`Shift: ${filterShift}`}
                    onRemove={() => setFilterShift("all")}
                  />
                )}
                {filterFrom && (
                  <FilterChip
                    label={`From: ${fmtDate(filterFrom)}`}
                    onRemove={() => setFilterFrom("")}
                  />
                )}
                {filterTo && (
                  <FilterChip
                    label={`To: ${fmtDate(filterTo)}`}
                    onRemove={() => setFilterTo("")}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Table ─────────────────────────────────────────────────────── */}
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
                  Showing {enrollments.length} record
                  {enrollments.length !== 1 ? "s" : ""}
                  {hasActiveFilters ? " (filtered)" : ""}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2 whitespace-nowrap">
                          Reg. ID
                        </th>
                        <th className="px-4 py-2 whitespace-nowrap">
                          Student
                        </th>
                        <th className="px-4 py-2">Class</th>
                        <th className="px-4 py-2">Shift</th>
                        <th className="px-4 py-2">Payment</th>
                        <th className="px-4 py-2 text-right whitespace-nowrap">
                          Amount
                        </th>
                        <th className="px-4 py-2 whitespace-nowrap">
                          Enrolled By
                        </th>
                        <th className="px-4 py-2 whitespace-nowrap">Date</th>
                        <th className="px-4 py-2 text-center">Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                            {e.registration_id ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                            {e.student_name}
                          </td>
                          <td className="px-4 py-2.5">{e.class}</td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${
                                e.shift === "MORNING"
                                  ? "border-amber-400 text-amber-700 bg-amber-50"
                                  : "border-indigo-400 text-indigo-700 bg-indigo-50"
                              }`}
                            >
                              {e.shift === "MORNING" ? "🌅 Morning" : "🌆 Evening"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${
                                e.payment_mode === "CASH"
                                  ? "border-green-400 text-green-700 bg-green-50"
                                  : "border-blue-400 text-blue-700 bg-blue-50"
                              }`}
                            >
                              {e.payment_mode === "CASH" ? "💵 Cash" : "🔁 Online"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                            {fmtINR(e.total_amount)}
                          </td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                            <span className="font-medium">{e.admin_name}</span>
                            {e.admin_id_label && e.admin_id_label !== "—" && (
                              <span className="block text-[10px] text-muted-foreground font-mono">
                                {e.admin_id_label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {fmtDate(e.enrolled_at)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
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
                                <span className="text-[10px] text-muted-foreground/40">
                                  —
                                </span>
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
                                <span className="text-[10px] text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Revenue footer */}
                <div className="border-t px-4 py-2.5 flex justify-between items-center text-sm">
                  <span className="text-xs text-muted-foreground">
                    Revenue (filtered)
                  </span>
                  <span className="font-bold">
                    {fmtINR(
                      enrollments.reduce((s, e) => s + e.total_amount, 0),
                    )}
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

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string | undefined;
  onRemove: () => void;
}) {
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
