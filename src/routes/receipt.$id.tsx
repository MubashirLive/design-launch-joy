import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { CAMP_NAME, ORG_NAME, fmtINR } from "@/lib/camp";

export const Route = createFileRoute("/receipt/$id")({
  component: ReceiptPage,
});

interface Enrollment {
  id: string;
  receipt_number: string;
  registration_number: number;
  registration_id: string;
  shift: "MORNING" | "EVENING";
  student_name: string;
  date_of_birth: string;
  age: number;
  gender: string;
  class: string;
  school_name: string;
  father_name: string;
  father_contact: string;
  activities: { activity_name: string; fee: number }[];
  mess_opted: boolean;
  mess_fee: number;
  transport_opted: boolean;
  transport_fee: number;
  combo_applied: boolean;
  combo_discount: number;
  total_amount: number;
  payment_mode: "CASH" | "ONLINE";
  enrolled_at: string;
  enrolled_by: string;
}

function ReceiptPage() {
  const { id } = Route.useParams();
  const { loading, session, role, adminProfile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Enrollment | null>(null);
  const [enrolledByLabel, setEnrolledByLabel] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    supabase.from("enrollments").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setData(data as unknown as Enrollment | null);
      if (data) {
        supabase.from("admins").select("admin_id,full_name").eq("user_id", (data as unknown as Enrollment).enrolled_by).maybeSingle()
          .then(({ data: a }) => {
            if (a) setEnrolledByLabel(`${a.full_name} (${a.admin_id})`);
            else setEnrolledByLabel("Super Admin");
          });
      }
    });
  }, [session, id]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const date = new Date(data.enrolled_at);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const dobD = new Date(data.date_of_birth);
  const dobStr = `${String(dobD.getDate()).padStart(2, "0")}/${String(dobD.getMonth() + 1).padStart(2, "0")}/${dobD.getFullYear()}`;
  const shiftLabel = data.shift === "MORNING" ? "Morning (7:00 AM – 12:00 Noon)" : "Evening (5:00 PM – 7:00 PM)";

  const homeTo = role === "super_admin" ? "/super" : "/dashboard";

  return (
    <div className="min-h-screen bg-muted/40 py-6 px-4">
      <div className="no-print mx-auto max-w-3xl flex justify-between mb-4">
        <Button variant="outline" asChild>
          <Link to={homeTo}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Print / Save PDF
        </Button>
      </div>

      <div className="receipt-print mx-auto max-w-3xl bg-white text-[#1F2937] rounded-md shadow-sm border border-border p-8 print:shadow-none print:border-0">
        <header className="text-center border-b pb-4">


          <h1 className="text-2xl font-bold tracking-tight">IDEAL INTERNATIONAL SCHOOL</h1>
          <p className="text-sm text-muted-foreground">{ORG_NAME}</p>
          <div className="mt-3 flex justify-between text-xs">
            <div><b>Receipt No:</b> {data.receipt_number}</div>
            <div><b>Date:</b> {dd}/{mm}/{yyyy}</div>
          </div>
          <div className="text-xs mt-1 text-left"><b>Enrolled By:</b> {enrolledByLabel || (adminProfile ? `${adminProfile.full_name} (${adminProfile.admin_id})` : "—")}</div>
        </header>

        <Section title="Student Information">
          <Row label="Registration ID" value={data.registration_id} mono />
          <Row label="Registration Number" value={String(data.registration_number).padStart(3, "0")} mono />
          <Row label="Student Full Name" value={data.student_name} />
          <Row label="Date of Birth" value={`${dobStr}     Age: ${data.age} years`} />
          <Row label="Gender" value={data.gender} />
          <Row label="Class" value={data.class} />
          <Row label="School Name" value={`${data.school_name} (Session 2025-26)`} />
          <Row label="Father's Name" value={data.father_name} />
          <Row label="Father's Contact" value={data.father_contact} />
          <Row label="Shift" value={shiftLabel} />
        </Section>

        <Section title="Fee Breakdown">
          <table className="w-full text-sm border border-border">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 w-10">#</th>
                <th className="text-left p-2">Description</th>
                <th className="text-right p-2 w-32">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: React.ReactElement[] = [];
                let n = 1;
                data.activities.forEach((a) => {
                  rows.push(
                    <tr key={`a${n}`} className="border-t">
                      <td className="p-2">{n}</td>
                      <td className="p-2">{a.activity_name} — {data.shift === "MORNING" ? "Morning" : "Evening"}</td>
                      <td className="p-2 text-right">{a.fee.toLocaleString("en-IN")}</td>
                    </tr>,
                  );
                  n++;
                });
                if (data.mess_opted) {
                  rows.push(
                    <tr key="mess" className="border-t">
                      <td className="p-2"></td>
                      <td className="p-2">Mess Facility</td>
                      <td className="p-2 text-right">{data.mess_fee.toLocaleString("en-IN")}</td>
                    </tr>,
                  );
                }
                if (data.combo_applied) {
                  rows.push(
                    <tr key="combo" className="border-t text-success-foreground">
                      <td className="p-2"></td>
                      <td className="p-2">Combo Discount</td>
                      <td className="p-2 text-right">-{data.combo_discount.toLocaleString("en-IN")}</td>
                    </tr>,
                  );
                }
                if (data.transport_opted) {
                  rows.push(
                    <tr key="trans" className="border-t">
                      <td className="p-2"></td>
                      <td className="p-2">Transport Fee</td>
                      <td className="p-2 text-right">{data.transport_fee.toLocaleString("en-IN")}</td>
                    </tr>,
                  );
                }
                return rows;
              })()}
              <tr className="border-t font-bold bg-muted/50">
                <td className="p-2"></td>
                <td className="p-2">TOTAL</td>
                <td className="p-2 text-right">{fmtINR(data.total_amount)}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="Payment Details">
          <Row label="Mode of Payment" value={data.payment_mode === "CASH" ? "Cash" : "Online"} />
          <Row label="Amount Received" value={fmtINR(data.total_amount)} />
        </Section>

        <footer className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
          This is a computer-generated receipt. No signature required.
          <br />For queries, contact the school office.
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide bg-muted px-2 py-1 rounded">{title}</h2>
      <div className="mt-2 space-y-1">{children}</div>
    </section>
  );
}
function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex text-sm">
      <div className="w-48 text-muted-foreground">{label}:</div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  );
}
