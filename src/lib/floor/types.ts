export type FloorRole = "admin" | "salesman";

export type CustomerStatus =
  | "new"
  | "contacted"
  | "follow_up"
  | "booked"
  | "sold"
  | "dead";

export type CallOutcome =
  | "connected"
  | "voicemail"
  | "no_answer"
  | "booked"
  | "sold"
  | "not_interested";

export type LeadSource = "inbound" | "outbound" | "referral" | "repeat" | "other";

export type PeriodKey = "today" | "week" | "month";

export type Profile = {
  userId: string;
  displayName: string;
  email: string | null;
  role: FloorRole;
  initials: string;
  monthlyGoal: number;
  active: boolean;
  markerColor: string;
};

export type Sale = {
  id: number;
  userId: string;
  customerId: number | null;
  customerName: string | null;
  dealValue: number;
  notes: string | null;
  soldOn: string;
  soldAt: string;
  createdBy: string;
  intelligence: boolean;
  painKiller: boolean;
  speedClose: boolean;
  firstDemoOn: string | null;
  refunded: boolean;
  refundedAt: string | null;
  markerColor: string;
  strokeJson: string | null;
};

export type SaleInput = {
  customerName: string;
  dealValue: number;
  notes: string;
  soldOn: string;
  intelligence: boolean;
  painKiller: boolean;
  speedClose: boolean;
  firstDemoOn: string;
  refunded?: boolean;
  customerId?: number;
  markerColor: string;
  strokeJson: string;
};

export type PostedSale = Sale & {
  quote: import("./pay").CloseQuote;
  pay: import("./pay").PayStatement;
};

export type Customer = {
  id: number;
  ownerId: string;
  ownerName: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  source: LeadSource | null;
  status: CustomerStatus;
  notes: string | null;
  nextFollowUp: string | null;
  lastContacted: string | null;
  monthlySpend: number | null;
  currentProvider: string | null;
  painNotes: string | null;
  firstDemoOn: string | null;
  createdAt: string;
  callCount: number;
  saleCount: number;
  sequenceKey: string | null;
  sequenceStartedOn: string | null;
  currentStepId: number | null;
  currentStepTitle: string | null;
  currentStepDue: string | null;
  currentStepIndex: number | null;
};

export type FollowUpStep = {
  id: number;
  customerId: number;
  ownerId: string;
  sequenceKey: string;
  stepIndex: number;
  title: string;
  action: "call" | "note";
  dueOn: string;
  doneAt: string | null;
  skippedAt: string | null;
};

export type SequenceTask = FollowUpStep & {
  customerName: string;
  company: string | null;
  phone: string | null;
  ownerName: string;
  totalSteps: number;
};

export type CustomerNote = {
  id: number;
  customerId: number;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type CustomerRecord = {
  customer: Customer;
  notes: CustomerNote[];
  calls: Call[];
  sales: Sale[];
  steps: FollowUpStep[];
};

export type Call = {
  id: number;
  userId: string;
  userName: string;
  customerId: number | null;
  customerName: string | null;
  calledOn: string;
  calledAt: string;
  outcome: CallOutcome;
  notes: string | null;
};

export type PersonColumn = Profile & {
  sales: Sale[];
  periodCount: number;
  todayCount: number;
  callCount: number;
  followUpsDue: number;
  monthPay: number;
  tierRate: number;
  closeRate: number;
  out: { kind: "sick" | "off"; untilOn: string | null; note: string } | null;
};

export type FloorState = {
  me: Profile;
  people: PersonColumn[];
  period: {
    key: PeriodKey;
    start: string;
    end: string;
    label: string;
  };
  alerts: FloorAlert[];
};

export type DayState = {
  me: Profile;
  todaySales: Sale[];
  todayCalls: Call[];
  followUps: Customer[];
  monthCount: number;
  monthGoal: number;
  weekCount: number;
};

export type ActivityRow = {
  id: number;
  actorId: string;
  actorName: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

export type FloorAlert = {
  id: number;
  actorId: string;
  actorName: string;
  targetId: string | null;
  message: string;
  kind: "hunt" | "lead" | "catch";
  createdAt: string;
};

export type Seat = {
  userId: string;
  displayName: string;
};
