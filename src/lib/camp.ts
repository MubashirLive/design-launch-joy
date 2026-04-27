// Camp constants — single source of truth for activities and fees
export const CAMP_NAME = "Summer Camp 2026";
export const ORG_NAME = "Summer Camp 2026";

export const MORNING_ACTIVITIES = [
  { name: "Swimming", fee: 2000, premium: true },
  { name: "Horse Riding", fee: 2000, premium: true },
  { name: "Skating", fee: 800, premium: false },
  { name: "Music", fee: 800, premium: false },
  { name: "AI", fee: 800, premium: false },
  { name: "Spoken English", fee: 800, premium: false },
  { name: "Dance", fee: 800, premium: false },
] as const;

export const EVENING_ACTIVITIES = [
  { name: "Horse Riding", fee: 1800 },
  { name: "Swimming", fee: 1500 },
] as const;

export const MESS_FEE = 1100;
export const COMBO_TOTAL = 3500;
export const COMBO_DISCOUNT = 400;

export const CLASSES = [
  "Nursery", "KG",
  "1st", "2nd", "3rd", "4th", "5th", "6th",
  "7th", "8th", "9th", "10th", "11th", "12th",
];

export type Shift = "MORNING" | "EVENING";

export interface SelectedActivity {
  activity_name: string;
  fee: number;
}

export interface FeeBreakdown {
  lines: { label: string; amount: number; isDiscount?: boolean }[];
  combo_applied: boolean;
  combo_discount: number;
  total: number;
}

export function computeFee(args: {
  shift: Shift;
  activities: string[];   // selected activity names (filtered, no empties)
  messOpted: boolean;
  transportOpted: boolean;
  transportFee: number;
}): FeeBreakdown {
  const { shift, activities, messOpted, transportOpted, transportFee } = args;
  const lines: FeeBreakdown["lines"] = [];

  if (shift === "EVENING") {
    let total = 0;
    activities.forEach((name) => {
      const def = EVENING_ACTIVITIES.find((a) => a.name === name);
      if (!def) return;
      lines.push({ label: `${name} — Evening`, amount: def.fee });
      total += def.fee;
    });
    return { lines, combo_applied: false, combo_discount: 0, total };
  }

  // MORNING
  const defs = activities
    .map((n) => MORNING_ACTIVITIES.find((a) => a.name === n))
    .filter((a): a is typeof MORNING_ACTIVITIES[number] => !!a);

  const premiums = defs.filter((a) => a.premium);
  const standards = defs.filter((a) => !a.premium);

  const comboEligible = premiums.length >= 1 && standards.length >= 1 && messOpted;
  const covered = new Set<string>();
  let total = 0;

  if (comboEligible) {
    const p = premiums[0];
    const s = standards[0];
    covered.add(p.name + ":P");
    covered.add(s.name + ":S");
    lines.push({ label: `${p.name} — Morning`, amount: p.fee });
    lines.push({ label: `${s.name} — Morning`, amount: s.fee });
    lines.push({ label: "Mess Facility", amount: MESS_FEE });
    lines.push({ label: "Combo Discount", amount: -COMBO_DISCOUNT, isDiscount: true });
    total = COMBO_TOTAL;

    // remaining activities
    const rest = [
      ...premiums.slice(1),
      ...standards.slice(1),
    ];
    rest.forEach((a) => {
      lines.push({ label: `${a.name} — Morning`, amount: a.fee });
      total += a.fee;
    });
  } else {
    defs.forEach((a) => {
      lines.push({ label: `${a.name} — Morning`, amount: a.fee });
      total += a.fee;
    });
    if (messOpted) {
      lines.push({ label: "Mess Facility", amount: MESS_FEE });
      total += MESS_FEE;
    }
  }

  if (transportOpted && transportFee > 0) {
    lines.push({ label: "Transport Fee", amount: transportFee });
    total += transportFee;
  }

  return {
    lines,
    combo_applied: comboEligible,
    combo_discount: comboEligible ? COMBO_DISCOUNT : 0,
    total,
  };
}

// Slot budget: morning => 5 (or 4 if transport), minus 1 if mess
// evening => 2
export function slotBudget(shift: Shift, transportOpted: boolean, messOpted: boolean) {
  if (shift === "EVENING") return { budget: 2, activitiesAllowed: 2 };
  const base = transportOpted ? 4 : 5;
  return { budget: base, activitiesAllowed: base - (messOpted ? 1 : 0) };
}

export function calcAge(dob: string): number {
  if (!dob) return 0;
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, age);
}

export function buildRegistrationId(args: {
  studentFirstName: string;
  shift: Shift;
  adminFormCount: number; // count INCLUDING this submission
  globalCount: number;
}): string {
  const raw = (args.studentFirstName || "")
    .trim()
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3);
  const padded = (raw + "___").slice(0, 3);
  const dd = String(new Date().getDate()).padStart(2, "0");
  const shiftCode = args.shift === "MORNING" ? "M" : "E";
  const ac = String(args.adminFormCount).padStart(2, "0");
  const gc = String(args.globalCount).padStart(3, "0");
  return `${padded}${dd}M${shiftCode}${ac}-${gc}`;
}

export function buildReceiptNumber(seq: number): string {
  return `SC2026-${String(seq).padStart(4, "0")}`;
}

export function fmtINR(n: number): string {
  return "₹ " + n.toLocaleString("en-IN");
}
