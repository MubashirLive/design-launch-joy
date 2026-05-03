// Camp constants - single source of truth for activities and fees
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

export const MORNING_ACTIVITIES_15_DAYS = [
  { name: "Swimming", fee: 1200, premium: true },
  { name: "Horse Riding", fee: 1500, premium: true },
  { name: "Skating", fee: 500, premium: false },
  { name: "Music", fee: 500, premium: false },
  { name: "AI", fee: 500, premium: false },
  { name: "Spoken English", fee: 500, premium: false },
  { name: "Dance", fee: 500, premium: false },
] as const;

export const EVENING_ACTIVITIES = [
  { name: "Horse Riding", fee: 1800 },
  { name: "Swimming", fee: 1500 },
] as const;

export const EVENING_ACTIVITIES_15_DAYS = [
  { name: "Horse Riding", fee: 1300 },
  { name: "Swimming", fee: 900 },
] as const;

export const MESS_FEE = 1100;
export const MESS_FEE_15_DAYS = 700;
export const COMBO_TOTAL = 3500;
export const COMBO_DISCOUNT = 400;

export const CLASSES = [
  "Nursery", "KG",
  "1st", "2nd", "3rd", "4th", "5th", "6th",
  "7th", "8th", "9th", "10th", "11th", "12th",
];

export type Shift = "MORNING" | "EVENING";
export type CampPlan = "FULL" | "15_DAYS";
export type CampPlanPeriod = "02 May to 15 May" | "16 May to 30 May";

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

export function getActivityFee(shift: Shift, plan: CampPlan, name: string): number {
  const activities =
    shift === "MORNING"
      ? plan === "15_DAYS"
        ? MORNING_ACTIVITIES_15_DAYS
        : MORNING_ACTIVITIES
      : plan === "15_DAYS"
        ? EVENING_ACTIVITIES_15_DAYS
        : EVENING_ACTIVITIES;
  return activities.find((activity) => activity.name === name)?.fee || 0;
}

export function getMessFee(plan: CampPlan): number {
  return plan === "15_DAYS" ? MESS_FEE_15_DAYS : MESS_FEE;
}

export function computeFee(args: {
  shift: Shift;
  plan?: CampPlan;
  activities: string[];
  messOpted: boolean;
  transportOpted: boolean;
  transportFee: number;
}): FeeBreakdown {
  const { shift, plan = "FULL", activities, messOpted, transportOpted, transportFee } = args;
  const lines: FeeBreakdown["lines"] = [];
  const morningActivities = plan === "15_DAYS" ? MORNING_ACTIVITIES_15_DAYS : MORNING_ACTIVITIES;
  const eveningActivities = plan === "15_DAYS" ? EVENING_ACTIVITIES_15_DAYS : EVENING_ACTIVITIES;
  const messFee = getMessFee(plan);
  const planLabel = plan === "15_DAYS" ? " 15 days" : "";

  if (shift === "EVENING") {
    let total = 0;
    activities.forEach((name) => {
      const def = eveningActivities.find((a) => a.name === name);
      if (!def) return;
      lines.push({ label: `${name} - Evening${planLabel}`, amount: def.fee });
      total += def.fee;
    });
    return { lines, combo_applied: false, combo_discount: 0, total };
  }

  const defs = activities
    .map((name) => morningActivities.find((activity) => activity.name === name))
    .filter((activity): activity is typeof morningActivities[number] => !!activity);

  const premiums = defs.filter((activity) => activity.premium);
  const standards = defs.filter((activity) => !activity.premium);
  const comboEligible = premiums.length >= 1 && standards.length >= 1 && messOpted;
  let total = 0;

  if (comboEligible) {
    const premium = premiums[0];
    const standard = standards[0];
    lines.push({ label: `${premium.name} - Morning${planLabel}`, amount: premium.fee });
    lines.push({ label: `${standard.name} - Morning${planLabel}`, amount: standard.fee });
    lines.push({ label: `Mess Facility${planLabel}`, amount: messFee });
    lines.push({ label: "Combo Discount", amount: -COMBO_DISCOUNT, isDiscount: true });
    total = premium.fee + standard.fee + messFee - COMBO_DISCOUNT;

    [...premiums.slice(1), ...standards.slice(1)].forEach((activity) => {
      lines.push({ label: `${activity.name} - Morning${planLabel}`, amount: activity.fee });
      total += activity.fee;
    });
  } else {
    defs.forEach((activity) => {
      lines.push({ label: `${activity.name} - Morning${planLabel}`, amount: activity.fee });
      total += activity.fee;
    });
    if (messOpted) {
      lines.push({ label: `Mess Facility${planLabel}`, amount: messFee });
      total += messFee;
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
  firstName: string;
  adminFormCount: number;
  globalCount: number;
}): string {
  const raw = (args.firstName || "")
    .trim()
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 3);
  const padded = (raw + "___").slice(0, 3);
  const monthCode = new Date()
    .toLocaleString("en-US", { month: "short" })
    .charAt(0)
    .toUpperCase();
  const dd = String(new Date().getDate()).padStart(2, "0");
  const ac = String(args.adminFormCount).padStart(3, "0");
  return `${padded}${ac}${monthCode}${dd}-${args.globalCount}`;
}

export function buildReceiptNumber(seq: number): string {
  return `SC2026-${String(seq).padStart(4, "0")}`;
}

export function fmtINR(n: number): string {
  return "₹ " + n.toLocaleString("en-IN");
}
