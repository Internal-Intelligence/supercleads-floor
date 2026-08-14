export const TAX_CLASS = {
  individual: "Individual / sole proprietor",
  c_corp: "C corporation",
  s_corp: "S corporation",
  partnership: "Partnership",
  trust: "Trust / estate",
  llc: "Limited liability company",
} as const;

export type TaxClass = keyof typeof TAX_CLASS;

export const TIME_KIND = {
  vacation: "Days off",
  personal: "Personal",
  unpaid: "Unpaid",
  sick: "Sick",
} as const;

export type TimeKind = keyof typeof TIME_KIND;

export const MSG_TOPIC = {
  payroll: "Pay / 1099",
  schedule: "Schedule",
  tax: "W-9 / tax",
  leads: "Leads / CRM",
  other: "Other",
} as const;

export type MsgTopic = keyof typeof MSG_TOPIC;

export type FormStatus = "draft" | "submitted" | "approved" | "returned";
export type RequestStatus = "pending" | "approved" | "denied" | "cancelled";

export type DeskProfile = {
  userId: string;
  displayName: string;
  email: string | null;
  legalName: string;
  phone: string;
  city: string;
  bio: string;
  emergencyName: string;
  emergencyPhone: string;
  workHours: string;
  monthlyGoal: number;
  markerColor: string;
  icSignedAt: string | null;
  payPlanSignedAt: string | null;
  onboardedAt: string | null;
};

export type W9Public = {
  legalName: string;
  businessName: string;
  taxClass: TaxClass;
  llcTaxClass: string;
  exemptPayeeCode: string;
  fatcaCode: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  tinType: "ssn" | "ein";
  tinLast4: string | null;
  hasTin: boolean;
  certify: boolean;
  signatureName: string;
  signedOn: string;
  status: FormStatus;
  adminNote: string;
  submittedAt: string | null;
  tinFull?: string;
};

export type BankPublic = {
  bankName: string;
  accountType: "checking" | "savings" | "";
  holderName: string;
  routingLast4: string | null;
  accountLast4: string | null;
  hasNumbers: boolean;
  status: FormStatus;
};

export type TimeRequest = {
  id: number;
  userId: string;
  userName: string;
  kind: TimeKind;
  startOn: string;
  endOn: string;
  note: string;
  status: RequestStatus;
  adminNote: string;
  createdAt: string;
};

export type Presence = {
  status: "on" | "sick" | "off";
  note: string;
  untilOn: string | null;
};

export type DeskThread = {
  id: number;
  userId: string;
  userName: string;
  topic: MsgTopic;
  subject: string;
  status: "open" | "closed";
  lastAt: string;
  unread: number;
  preview: string;
};

export type DeskMessage = {
  id: number;
  threadId: number;
  authorId: string;
  authorName: string;
  mine: boolean;
  body: string;
  createdAt: string;
};

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  hint: string;
};

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function maskTin(type: "ssn" | "ein", last4: string | null) {
  if (!last4) return type === "ein" ? "••-•••••••" : "•••-••-••••";
  return type === "ein" ? `••-••••${last4}` : `•••-••-${last4}`;
}

export function validateTin(type: "ssn" | "ein", raw: string) {
  const d = digitsOnly(raw);
  if (d.length !== 9) return `${type === "ein" ? "EIN" : "SSN"} must be 9 digits`;
  if (/^(\d)\1{8}$/.test(d)) return "That number is not valid";
  return null;
}

export function validateRouting(raw: string) {
  const d = digitsOnly(raw);
  if (d.length !== 9) return "Routing number is 9 digits";
  return null;
}

export function buildChecklist(input: {
  profile: DeskProfile;
  w9: W9Public | null;
  bank: BankPublic | null;
}): ChecklistItem[] {
  const p = input.profile;
  return [
    {
      key: "profile",
      label: "Desk profile",
      done: Boolean(p.legalName && p.phone),
      hint: "Legal name and phone so payroll and the floor can reach you",
    },
    {
      key: "w9",
      label: "W-9 on file",
      done: Boolean(input.w9 && (input.w9.status === "submitted" || input.w9.status === "approved")),
      hint: "Required before SuperC can pay you or file your 1099-NEC",
    },
    {
      key: "bank",
      label: "Direct deposit",
      done: Boolean(input.bank && (input.bank.status === "submitted" || input.bank.status === "approved")),
      hint: "Where commission lands",
    },
    {
      key: "ic",
      label: "Contractor agreement",
      done: Boolean(p.icSignedAt),
      hint: "You work as a 1099 independent contractor, not an employee",
    },
    {
      key: "plan",
      label: "Pay plan",
      done: Boolean(p.payPlanSignedAt),
      hint: "Tiers, SPIFs, Fast Start, chargebacks",
    },
  ];
}

export const IC_COPY = `I am signing on as an independent contractor (Form 1099-NEC) for SuperC-Leads, not as an employee.

I set my own hours, use my own tools, and am responsible for my own taxes, insurance, and expenses. SuperC-Leads does not withhold income tax, Social Security, or Medicare, and does not provide employee benefits, unemployment, or workers' compensation.

Commission is earned only on closed, collected SuperC-Leads ownerships per the posted pay plan. Chargebacks, refunds, and clawbacks apply as written. SuperC-Leads may issue Form 1099-NEC for the tax year based on the W-9 I submit.

I can be removed from the floor at any time. This is not an employment contract and does not guarantee leads, income, or a territory.`;

export const PAY_PLAN_COPY = `I have read the SuperC-Leads Aggressive Sales pay plan:

• Progressive re-rate on closed ownerships ($4,995): 10% (1–4), 14% (5–8), 20% (9–11), 24% (12–19), 35% (20+).
• Fast Start $1,000. Milestones at 4 / 9 / 12 / 20. $250 extra per close at 20+.
• SPIFs: Intelligence $175, Pain Killer $100, Speed Close $100. Clean Streak $500 every 5 clean closes.
• Refunds charge back 50% of that deal's pay.

I understand my Pay page is the live statement and that admin can override an X, a goal, or a refund on my column.`;
