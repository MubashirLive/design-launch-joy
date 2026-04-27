import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CAMP_NAME, CLASSES, EVENING_ACTIVITIES, MORNING_ACTIVITIES, MESS_FEE,
  calcAge, computeFee, fmtINR, slotBudget, buildRegistrationId, buildReceiptNumber,
  type Shift,
} from "@/lib/camp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/enroll")({
  component: EnrollPage,
});

function EnrollPage() {
  const { loading, role, session, adminProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session || (role !== "admin" && role !== "super_admin")) navigate({ to: "/login" });
  }, [loading, role, session, navigate]);

  const [shift, setShift] = useState<Shift>("MORNING");
  const [studentName, setStudentName] = useState("");
  const [dob, setDob] = useState("");
  const age = useMemo(() => calcAge(dob), [dob]);
  const [gender, setGender] = useState("");
  const [klass, setKlass] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherContact, setFatherContact] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherContact, setMotherContact] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [address, setAddress] = useState("");
  const [cityChoice, setCityChoice] = useState<"Indore" | "Other" | "">("");
  const [otherCity, setOtherCity] = useState("");

  const [act, setAct] = useState<string[]>([""]);
  const [messOpted, setMessOpted] = useState(false);
  const [transportOpted, setTransportOpted] = useState(false);
  const [transportAddress, setTransportAddress] = useState("");
  const [transportFee, setTransportFee] = useState<number | "">("");

  const [allergies, setAllergies] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "ONLINE" | "">("");
  const [remarks, setRemarks] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAct([""]);
    setMessOpted(false);
    setTransportOpted(false);
    setTransportFee("");
    setTransportAddress("");
  }, [shift]);

  const selected = act.filter(Boolean);
  const { activitiesAllowed } = slotBudget(shift, transportOpted, messOpted);
  const slotsUsed = selected.length + (messOpted && shift === "MORNING" ? 1 : 0);
  const slotBudgetTotal = shift === "MORNING" ? (transportOpted ? 4 : 5) : 2;

  useEffect(() => {
    if (selected.length > activitiesAllowed) {
      const trimmed = selected.slice(0, activitiesAllowed);
      while (trimmed.length < act.length) trimmed.push("");
      setAct(trimmed.length ? trimmed : [""]);
      toast.warning("Activity slots reduced to fit new budget.");
    }
  }, [transportOpted, messOpted]);

  const fee = useMemo(
    () => computeFee({
      shift, activities: selected, messOpted: shift === "MORNING" && messOpted,
      transportOpted: shift === "MORNING" && transportOpted,
      transportFee: typeof transportFee === "number" ? transportFee : 0,
    }),
    [shift, selected, messOpted, transportOpted, transportFee],
  );

  const activityOptions = shift === "MORNING" ? MORNING_ACTIVITIES : EVENING_ACTIVITIES;
  const maxRows = shift === "MORNING" ? 5 : 2;

  function setActivityAt(i: number, val: string) {
    const next = [...act];
    next[i] = val;
    setAct(next);
  }

  function addRow() {
    if (act.length >= maxRows) return;
    if (selected.length >= activitiesAllowed) return;
    setAct([...act, ""]);
  }
  function removeRow(i: number) {
    const next = act.filter((_, idx) => idx !== i);
    setAct(next.length ? next : [""]);
  }

  function isOptionDisabled(name: string, currentIdx: number): boolean {
    return selected.some((v, idx) => v === name && idx !== currentIdx);
  }

  const slotColor = slotsUsed >= slotBudgetTotal
    ? "text-destructive border-destructive"
    : slotsUsed === slotBudgetTotal - 1
      ? "text-warning-foreground border-warning"
      : "text-success-foreground border-success";

  function validate(): string | null {
    if (studentName.trim().length < 3) return "Student name must be at least 3 characters";
    if (!dob) return "Date of birth is required";
    if (!gender) return "Gender is required";
    if (!klass) return "Class is required";
    if (!school.trim()) return "School name is required";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Valid email required";
    if (!fatherName.trim()) return "Father's name required";
    if (!/^\d{10}$/.test(fatherContact)) return "Father's contact must be 10 digits";
    if (motherContact && !/^\d{10}$/.test(motherContact)) return "Mother's contact must be 10 digits";
    if (!/^\d{10}$/.test(emergencyContact)) return "Emergency contact must be 10 digits";
    if (!address.trim()) return "Address required";
    if (!cityChoice) return "City required";
    if (cityChoice === "Other" && !otherCity.trim()) return "City name required";
    if (selected.length < 1) return "At least 1 activity required";
    if (shift === "MORNING" && transportOpted) {
      if (!transportAddress.trim()) return "Transport address required";
      if (typeof transportFee !== "number" || transportFee <= 0) return "Transport fee required";
    }
    if (!paymentMode) return "Payment mode required";
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!session || !adminProfile) { toast.error("Not signed in"); return; }
    setBusy(true);
    try {
      const { data: regNum, error: e1 } = await supabase.rpc("next_counter", { _name: "global_registration" });
      if (e1) throw e1;
      const { data: recSeq, error: e2 } = await supabase.rpc("next_counter", { _name: "receipt" });
      if (e2) throw e2;

      const adminFormCount = (adminProfile.forms_filled_count || 0) + 1;
      const regId = buildRegistrationId({
        studentFirstName: studentName.trim().split(" ")[0],
        shift,
        adminFormCount,
        globalCount: regNum as number,
      });
      const receiptNumber = buildReceiptNumber(recSeq as number);

      const activitiesPayload = selected.map((name) => {
        const def = activityOptions.find((a) => a.name === name);
        return { activity_name: name, fee: def?.fee || 0 };
      });

      const { data, error } = await supabase
        .from("enrollments")
        .insert({
          receipt_number: receiptNumber,
          registration_number: regNum as number,
          registration_id: regId,
          is_draft: false,
          shift,
          student_name: studentName.trim(),
          date_of_birth: dob,
          age,
          gender,
          class: klass,
          school_name: school.trim(),
          email: email.trim(),
          father_name: fatherName.trim(),
          father_contact: fatherContact,
          mother_name: motherName.trim() || null,
          mother_contact: motherContact || null,
          emergency_contact: emergencyContact,
          address: address.trim(),
          city: cityChoice === "Other" ? otherCity.trim() : "Indore",
          activities: activitiesPayload,
          mess_opted: shift === "MORNING" && messOpted,
          mess_fee: shift === "MORNING" && messOpted ? MESS_FEE : 0,
          transport_opted: shift === "MORNING" && transportOpted,
          transport_address: shift === "MORNING" && transportOpted ? transportAddress : null,
          transport_fee: shift === "MORNING" && transportOpted && typeof transportFee === "number" ? transportFee : 0,
          combo_applied: fee.combo_applied,
          combo_discount: fee.combo_discount,
          total_amount: fee.total,
          payment_mode: paymentMode as "CASH" | "ONLINE",
          allergies_medications: allergies || null,
          remarks: remarks || null,
          enrolled_by: session.user.id,
        })
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Enrollment saved");
      await refreshProfile();
      navigate({ to: "/receipt/$id", params: { id: data!.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) return null;

  return (
    <AppShell title="New Enrollment">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <Label className="mb-2 block">Shift</Label>
              <div className="grid grid-cols-2 gap-2">
                <ShiftButton active={shift === "MORNING"} onClick={() => setShift("MORNING")}>
                  Morning (7 AM – 12 Noon)
                </ShiftButton>
                <ShiftButton active={shift === "EVENING"} onClick={() => setShift("EVENING")}>
                  Evening (5 PM – 7 PM)
                </ShiftButton>
              </div>
            </CardContent>
          </Card>

          <SectionCard title="Participant Information">
            <Field label="Student Name *">
              <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of Birth *">
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </Field>
              <Field label="Age">
                <Input value={age ? `${age} years` : ""} readOnly className="bg-muted" />
              </Field>
            </div>
            <Field label="Gender *">
              <RadioGroup value={gender} onValueChange={setGender} className="flex gap-6">
                <Radio v="Girl" current={gender}>Girl</Radio>
                <Radio v="Boy" current={gender}>Boy</Radio>
              </RadioGroup>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class *">
                <Select value={klass} onValueChange={setKlass}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="School Name (Session 2025-26) *">
                <Input value={school} onChange={(e) => setSchool(e.target.value)} />
              </Field>
            </div>
            <Field label="Email *">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Father's Name *">
                <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
              </Field>
              <Field label="Father's Contact *">
                <Input maxLength={10} value={fatherContact} onChange={(e) => setFatherContact(e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mother's Name">
                <Input value={motherName} onChange={(e) => setMotherName(e.target.value)} />
              </Field>
              <Field label="Mother's Contact">
                <Input maxLength={10} value={motherContact} onChange={(e) => setMotherContact(e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
            <Field label="Emergency Contact *">
              <Input maxLength={10} value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Address *">
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="City *">
              <RadioGroup value={cityChoice} onValueChange={(v) => setCityChoice(v as "Indore" | "Other")} className="flex gap-6">
                <Radio v="Indore" current={cityChoice}>Indore</Radio>
                <Radio v="Other" current={cityChoice}>Other</Radio>
              </RadioGroup>
              {cityChoice === "Other" && (
                <Input className="mt-2" placeholder="City name" value={otherCity} onChange={(e) => setOtherCity(e.target.value)} />
              )}
            </Field>
          </SectionCard>

          <SectionCard title="Activities">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm font-medium ${slotColor}`}>
              Slots Used: {slotsUsed} / {slotBudgetTotal}
            </div>
            {act.map((val, i) => (
              <div key={i} className="flex gap-2">
                <Select value={val} onValueChange={(v) => setActivityAt(i, v)}>
                  <SelectTrigger><SelectValue placeholder={`Activity ${i + 1}${i === 0 ? " (required)" : ""}`} /></SelectTrigger>
                  <SelectContent>
                    {activityOptions.map((a) => (
                      <SelectItem key={a.name} value={a.name} disabled={isOptionDisabled(a.name, i)}>
                        {a.name} — {fmtINR(a.fee)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {act.length > 1 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => removeRow(i)}>×</Button>
                )}
              </div>
            ))}
            {act.length < maxRows && selected.length < activitiesAllowed && (
              <Button type="button" variant="outline" size="sm" onClick={addRow}>+ Add activity</Button>
            )}
          </SectionCard>

          {shift === "MORNING" && (
            <>
              <SectionCard title="Mess">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={messOpted}
                    onCheckedChange={(v) => {
                      const want = !!v;
                      if (want && selected.length >= activitiesAllowed) {
                        toast.warning("Reduce activities first to opt for Mess");
                        return;
                      }
                      setMessOpted(want);
                    }}
                  />
                  <span className="text-sm">
                    <b>Mess Facility — {fmtINR(MESS_FEE)}</b>
                    <br />
                    <span className="text-muted-foreground text-xs">
                      Includes one meal slot. Reduces available activity slots by 1.
                    </span>
                  </span>
                </label>
              </SectionCard>

              <SectionCard title="Transport">
                <Field label="Transport Required?">
                  <RadioGroup value={transportOpted ? "Y" : "N"} onValueChange={(v) => setTransportOpted(v === "Y")} className="flex gap-6">
                    <Radio v="Y" current={transportOpted ? "Y" : "N"}>Yes</Radio>
                    <Radio v="N" current={transportOpted ? "Y" : "N"}>No</Radio>
                  </RadioGroup>
                </Field>
                {transportOpted && (
                  <>
                    <Field label="Transport Address & Nearest Landmark *">
                      <Textarea value={transportAddress} onChange={(e) => setTransportAddress(e.target.value)} />
                    </Field>
                    <Field label="Transport Fee (₹) *">
                      <Input
                        type="number" min={0}
                        value={transportFee}
                        onChange={(e) => setTransportFee(e.target.value === "" ? "" : Number(e.target.value))}
                      />
                    </Field>
                  </>
                )}
              </SectionCard>
            </>
          )}

          <SectionCard title="Other Details">
            <Field label="Allergies & Medications">
              <Textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} />
            </Field>
            <Field label="Mode of Payment *">
              <RadioGroup value={paymentMode} onValueChange={(v) => setPaymentMode(v as "CASH" | "ONLINE")} className="flex gap-6">
                <Radio v="CASH" current={paymentMode}>Cash</Radio>
                <Radio v="ONLINE" current={paymentMode}>Online</Radio>
              </RadioGroup>
            </Field>
            <Field label="Remarks">
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </SectionCard>

          <div className="flex justify-end gap-2 pb-24 lg:pb-0">
            <Button onClick={handleSubmit} disabled={busy} size="lg">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit & Generate Receipt
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-semibold mb-2">{CAMP_NAME} — Fee</div>
              <div className="text-xs text-muted-foreground mb-3">
                {shift === "MORNING" ? "Morning shift" : "Evening shift"}
              </div>
              {fee.lines.length === 0 && (
                <div className="text-sm text-muted-foreground">No selections yet.</div>
              )}
              <ul className="space-y-1 text-sm">
                {fee.lines.map((l, i) => (
                  <li key={i} className={`flex justify-between ${l.isDiscount ? "text-success-foreground font-medium" : ""}`}>
                    <span>{l.label}</span>
                    <span>{l.amount < 0 ? `- ${fmtINR(-l.amount)}` : fmtINR(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t pt-3 flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{fmtINR(fee.total)}</span>
              </div>
              {fee.combo_applied && (
                <div className="mt-2 text-xs text-success-foreground">✓ Combo offer applied</div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Radio({ v, current, children }: { v: string; current: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <RadioGroupItem value={v} checked={current === v} />
      <span className="text-sm">{children}</span>
    </label>
  );
}
function ShiftButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border-2 px-4 py-3 text-sm font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}
