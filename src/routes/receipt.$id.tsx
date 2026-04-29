import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, MessageCircle, Printer, Trash2 } from "lucide-react";
import { ORG_NAME, fmtINR } from "@/lib/camp";
import { toast } from "sonner";
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
import Logo from "../assets/logo.png";

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
  mother_name: string | null;
  emergency_contact: string;
  activities: { activity_name: string; fee: number }[];
  mess_opted: boolean;
  mess_fee: number;
  transport_opted: boolean;
  transport_fee: number;
  combo_applied: boolean;
  combo_discount: number;
  total_amount: number;
  payment_mode: "CASH" | "ONLINE";
  transaction_id: string | null;
  enrolled_at: string;
  enrolled_by: string;
}

function fileNamePart(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildReceiptFileName(
  data: Pick<Enrollment, "registration_number" | "student_name" | "father_name" | "shift">,
) {
  const serial = String(data.registration_number).padStart(3, "0");
  const student = fileNamePart(data.student_name) || "Student";
  const father = fileNamePart(data.father_name) || "Father";
  const shift = data.shift === "MORNING" ? "Morning" : "Evening";
  return `${serial}${student}_${father}_${shift}`;
}

function printReceipt(fileName: string) {
  document.title = fileName;
  // Use matchMedia to check if print is supported
  if (window.matchMedia("print").matches) {
    window.print();
  } else {
    // Fallback: just trigger print dialog directly
    window.print();
  }
}

function ReceiptPage() {
  const { id } = Route.useParams();
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Enrollment | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("enrollments")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setData(data as unknown as Enrollment | null);
      });
  }, [session, id]);

  useEffect(() => {
    if (!data) return;
    const previousTitle = document.title;
    document.title = buildReceiptFileName(data);
    return () => {
      document.title = previousTitle;
    };
  }, [data]);

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
  const timeStr = date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  const dobD = new Date(data.date_of_birth);
  const dobStr = `${String(dobD.getDate()).padStart(2, "0")}/${String(dobD.getMonth() + 1).padStart(2, "0")}/${dobD.getFullYear()}`;
  const shiftLabel =
    data.shift === "MORNING" ? "Morning (7:00 AM – 12:00 Noon)" : "Evening (5:00 PM – 7:00 PM)";

  const homeTo = role === "super_admin" ? "/super" : "/dashboard";
  const receiptUrl = typeof window !== "undefined" ? window.location.href : "";
  const receiptFileName = buildReceiptFileName(data);
  const whatsappText = encodeURIComponent(
    [
      `${ORG_NAME} Receipt`,
      `PDF File Name: ${receiptFileName}.pdf`,
      `Registration No.: ${data.registration_id}`,
      `Student: ${data.student_name}`,
      `Amount: ${fmtINR(data.total_amount)}`,
      `Date: ${dd}/${mm}/${yyyy}`,
      receiptUrl,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  async function handleDelete() {
    if (!data) return;
    try {
      const { error } = await supabase.from("enrollments").delete().eq("id", data.id);
      if (error) throw error;
      toast.success("Enrollment deleted");
      navigate({ to: "/super" });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 py-6 px-4">
      <div className="no-print mx-auto max-w-3xl flex justify-between gap-1.5 mb-4">
        <Button variant="outline" asChild>
          <Link to={homeTo}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={() => printReceipt(receiptFileName)}
            size="icon"
            title={`Download ${receiptFileName}.pdf`}
            aria-label={`Download ${receiptFileName}.pdf`}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button onClick={() => printReceipt(receiptFileName)} variant="outline">
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button asChild variant="outline" className="bg-[#25D366] text-white hover:bg-[#1ebe5d]">
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
            </a>
          </Button>
          {role === "super_admin" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete enrollment"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Enrollment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the enrollment for{" "}
                    <strong>{data.student_name}</strong> (Receipt: {data.receipt_number}). This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    Yes, delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="receipt-print mx-auto max-w-3xl bg-white text-[#1F2937] rounded-md shadow-sm border border-border p-6 print:shadow-none print:border-0">
        <header className="text-center border-b pb-3">
  {/* Top Row (unchanged) */}
  <div className="inline-flex justify-between items-center">
    <div className="inline-flex items-center justify-center rounded-2xl">
      <img src={Logo} alt="Logo" className="h-20 w-20" />
    </div>
    <div>
      <h1 className="text-xl font-bold tracking-tight">
        IDEAL INTERNATIONAL SCHOOL, INDORE
      </h1>
      <p className="text-sm text-muted-foreground">{ORG_NAME}</p>
    </div>
  </div>

  {/* Bottom Row (fixed layout) */}
  <div className="mt-3 flex justify-between items-center">
    
    {/* Left: Registration No */}
    <div className="text-left">
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        Registration Number
      </div>
      <div className="font-mono text-3xl font-bold tracking-wide text-primary">
        {data.registration_id.split("-").slice(-1)[0]}
      </div>
    </div>

    {/* Right: Date & Time */}
    <div className="text-xs text-right leading-5">
      <div>
        <b>Date:</b> {dd}/{mm}/{yyyy}
      </div>
      <div>
        <b>Time:</b> {timeStr}
      </div>
    </div>

  </div>
</header>

        <Section title="Student Information">
          <Row label="Registration ID" value={data.registration_id} />
          <Row label="Student Full Name" value={data.student_name} />
          <Row label="Date of Birth" value={`${dobStr}     Age: ${data.age} years`} />
          <Row label="Gender" value={data.gender} />
          <Row label="Class" value={data.class} />
          <Row label="School Name" value={`${data.school_name} (Session 2025-26)`} />
          <Row label="Father's Name" value={data.father_name} />
          <Row label="Father's Contact" value={data.father_contact} />
          <Row label="Mother's Name" value={data.mother_name || "-"} />
          <Row label="Emergency Contact" value={data.emergency_contact} />
          <Row label="Shift" value={shiftLabel} />
        </Section>

        <Section title="Fee Breakdown">
          <table className="w-full text-sm border border-border">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-1.5 w-10">#</th>
                <th className="text-left p-1.5">Description</th>
                <th className="text-right p-1.5 w-32">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: React.ReactElement[] = [];
                let n = 1;
                data.activities.forEach((a) => {
                  rows.push(
                    <tr key={`a${n}`} className="border-t">
                      <td className="p-1.5">{n}</td>
                      <td className="p-1.5">
                        {a.activity_name} — {data.shift === "MORNING" ? "Morning" : "Evening"}
                      </td>
                      <td className="p-1.5 text-right">{a.fee.toLocaleString("en-IN")}</td>
                    </tr>,
                  );
                  n++;
                });
                if (data.mess_opted) {
                  rows.push(
                    <tr key="mess" className="border-t">
                      <td className="p-1.5"></td>
                      <td className="p-1.5">Mess Facility</td>
                      <td className="p-1.5 text-right">{data.mess_fee.toLocaleString("en-IN")}</td>
                    </tr>,
                  );
                }
                if (data.combo_applied) {
                  rows.push(
                    <tr key="combo" className="border-t text-success-foreground">
                      <td className="p-1.5"></td>
                      <td className="p-1.5">Combo Discount</td>
                      <td className="p-1.5 text-right">
                        -{data.combo_discount.toLocaleString("en-IN")}
                      </td>
                    </tr>,
                  );
                }
                if (data.transport_opted) {
                  rows.push(
                    <tr key="trans" className="border-t">
                      <td className="p-1.5"></td>
                      <td className="p-1.5">Transport Fee</td>
                      <td className="p-1.5 text-right">
                        {data.transport_fee.toLocaleString("en-IN")}
                      </td>
                    </tr>,
                  );
                }
                return rows;
              })()}
              <tr className="border-t font-bold bg-muted/50">
                <td className="p-1.5"></td>
                <td className="p-1.5">TOTAL</td>
                <td className="p-1.5 text-right">{fmtINR(data.total_amount)}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="Payment Details">
          <Row label="Mode of Payment" value={data.payment_mode === "CASH" ? "Cash" : "Online"} />
          {data.payment_mode === "ONLINE" && (
            <Row label="Transaction ID" value={data.transaction_id || "—"} mono />
          )}
          <Row label="Amount Received" value={fmtINR(data.total_amount)} />
        </Section>

        <footer className="mt-5 pt-3 border-t text-center text-xs text-muted-foreground">
          This is a computer-generated receipt. No signature required.
          <br />
          For queries, contact the school office.
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide bg-muted px-2 py-1 rounded">
        {title}
      </h2>
      <div className="mt-1.5 space-y-0.5">{children}</div>
    </section>
  );
}
function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex text-[13px] leading-5">
      <div className="w-44 shrink-0 text-muted-foreground">{label}:</div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  );
}

