import { createServerFn } from "@tanstack/react-start";
import { dbSource, getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { periodRange, todayIso, initialsFrom, toIsoDay, firstName, isIsoDay } from "./period";
import type {
  ActivityRow,
  Call,
  Customer,
  CustomerNote,
  CustomerRecord,
  CustomerStatus,
  DayState,
  FloorAlert,
  FloorRole,
  FloorState,
  FollowUpStep,
  LeadSource,
  PeriodKey,
  PersonColumn,
  PostedSale,
  Profile,
  Sale,
  Seat,
  SequenceTask,
} from "./types";
import { computePay, quoteClose, qualifiesSpeedClose } from "./pay";
import type { PayStatement } from "./pay";
import { DEFAULT_MARKER, hasDrawnX, parseStrokes } from "./markers";
import { FLOOR_ADMIN_EMAIL, isFloorAdminEmail } from "./admin";
import { buildRepConversion, mergeConversions, type RepConversion } from "./conversion";
import { buildSequencePlan, isSequenceKey, sequenceOf, type SequenceKey } from "./sequence";

type ProfileRow = {
  user_id: string;
  display_name: string;
  email: string | null;
  role: string;
  initials: string;
  monthly_goal: number;
  active: boolean;
  marker_color?: string;
};

type SaleRow = {
  id: number;
  user_id: string;
  customer_id?: number | null;
  customer_name: string | null;
  deal_value: string | number;
  notes: string | null;
  sold_on: string;
  sold_at: string;
  created_by: string;
  intelligence: boolean;
  pain_killer: boolean;
  speed_close: boolean;
  first_demo_on: string | null;
  refunded: boolean;
  refunded_at: string | null;
  marker_color?: string | null;
  stroke_json?: string | null;
};

type CustomerRow = {
  id: number;
  owner_id: string;
  owner_name: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  next_follow_up: string | null;
  last_contacted: string | null;
  monthly_spend: string | number | null;
  current_provider: string | null;
  pain_notes: string | null;
  first_demo_on: string | null;
  created_at: string;
  call_count?: number;
  sale_count?: number;
  sequence_key?: string | null;
  sequence_started_on?: string | null;
  current_step_id?: number | null;
  current_step_title?: string | null;
  current_step_due?: string | null;
  current_step_index?: number | null;
};

type CallRow = {
  id: number;
  user_id: string;
  user_name: string;
  customer_id: number | null;
  customer_name: string | null;
  called_on: string;
  called_at: string;
  outcome: string;
  notes: string | null;
};

function toNum(v: string | number | null | undefined) {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function speedFromDemo(firstDemoOn: string | null, soldOn: string) {
  return qualifiesSpeedClose(firstDemoOn, soldOn);
}

async function loadPayBooks(userId: string) {
  const sql = await getSql();
  const month = periodRange("month");
  const monthRows = await sql<SaleRow>`
    select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
           intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
           marker_color, stroke_json
    from sales
    where user_id = ${userId} and sold_on >= ${month.start} and sold_on <= ${month.end}
    order by sold_on, sold_at
  `;
  const lifeRows = await sql<SaleRow>`
    select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
           intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
           marker_color, stroke_json
    from sales
    where user_id = ${userId}
    order by sold_on, sold_at
  `;
  return {
    month: monthRows.map(mapSale),
    life: lifeRows.map(mapSale),
  };
}

function mapProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    role: row.role === "admin" ? "admin" : "salesman",
    initials: row.initials,
    monthlyGoal: toNum(row.monthly_goal),
    active: Boolean(row.active),
    markerColor: row.marker_color || DEFAULT_MARKER,
  };
}

function mapSale(row: SaleRow): Sale {
  return {
    id: toNum(row.id),
    userId: row.user_id,
    customerId: row.customer_id == null ? null : toNum(row.customer_id),
    customerName: row.customer_name,
    dealValue: toNum(row.deal_value),
    notes: row.notes,
    soldOn: row.sold_on,
    soldAt: String(row.sold_at),
    createdBy: row.created_by,
    intelligence: Boolean(row.intelligence),
    painKiller: Boolean(row.pain_killer),
    speedClose: Boolean(row.speed_close),
    firstDemoOn: row.first_demo_on,
    refunded: Boolean(row.refunded),
    refundedAt: row.refunded_at ? String(row.refunded_at) : null,
    markerColor: row.marker_color || DEFAULT_MARKER,
    strokeJson: row.stroke_json ?? null,
  };
}

function mapCustomer(row: CustomerRow): Customer {
  const spend = row.monthly_spend == null ? null : toNum(row.monthly_spend);
  const source = row.source;
  return {
    id: toNum(row.id),
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    name: row.name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    city: row.city ?? null,
    source:
      source === "inbound" ||
      source === "outbound" ||
      source === "referral" ||
      source === "repeat" ||
      source === "other"
        ? source
        : null,
    status: row.status as CustomerStatus,
    notes: row.notes,
    nextFollowUp: row.next_follow_up,
    lastContacted: row.last_contacted,
    monthlySpend: spend,
    currentProvider: row.current_provider ?? null,
    painNotes: row.pain_notes ?? null,
    firstDemoOn: row.first_demo_on ?? null,
    createdAt: toIsoDay(row.created_at) || String(row.created_at),
    callCount: toNum(row.call_count),
    saleCount: toNum(row.sale_count),
    sequenceKey: row.sequence_key ?? null,
    sequenceStartedOn: row.sequence_started_on ?? null,
    currentStepId: row.current_step_id == null ? null : toNum(row.current_step_id),
    currentStepTitle: row.current_step_title ?? null,
    currentStepDue: row.current_step_due ?? null,
    currentStepIndex: row.current_step_index == null ? null : toNum(row.current_step_index),
  };
}

function mapCall(row: CallRow): Call {
  return {
    id: toNum(row.id),
    userId: row.user_id,
    userName: row.user_name,
    customerId: row.customer_id == null ? null : toNum(row.customer_id),
    customerName: row.customer_name,
    calledOn: row.called_on,
    calledAt: String(row.called_at),
    outcome: row.outcome as Call["outcome"],
    notes: row.notes,
  };
}

function mapAlert(row: {
  id: number;
  actor_id: string;
  actor_name: string;
  target_id: string | null;
  message: string;
  kind: string;
  created_at: string;
}): FloorAlert {
  return {
    id: toNum(row.id),
    actorId: row.actor_id,
    actorName: row.actor_name,
    targetId: row.target_id,
    message: row.message,
    kind: row.kind === "lead" || row.kind === "catch" ? row.kind : "hunt",
    createdAt: String(row.created_at),
  };
}

async function loadAuthUser(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ name: string; email: string }>`
    select name, email from "user" where id = ${userId} limit 1
  `;
  return rows[0] ?? { name: "Rep", email: "" };
}

async function healAdminSeats() {
  const sql = await getSql();
  await sql`
    update profiles
    set role = case
      when lower(trim(coalesce(email, ''))) = ${FLOOR_ADMIN_EMAIL} then 'admin'
      else 'salesman'
    end,
    updated_at = now()
    where role is distinct from (
      case
        when lower(trim(coalesce(email, ''))) = ${FLOOR_ADMIN_EMAIL} then 'admin'
        else 'salesman'
      end
    )
  `;
}

async function getProfile(userId: string) {
  const sql = await getSql();
  const rows = await sql<ProfileRow>`
    select user_id, display_name, email, role, initials, monthly_goal, active, marker_color
    from profiles where user_id = ${userId} limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const auth = await loadAuthUser(userId);
  const email = auth.email?.trim() || row.email;
  const role: FloorRole = isFloorAdminEmail(email) ? "admin" : "salesman";
  if (row.email !== email || row.role !== role) {
    await sql`
      update profiles
      set email = ${email},
          role = ${role},
          updated_at = now()
      where user_id = ${userId}
    `;
  }
  return mapProfile({ ...row, email, role });
}

async function requireProfile(userId: string) {
  const profile = await ensureProfileFor(userId);
  if (!profile.active) {
    throw new Error("Your floor access is paused. Ask an admin to restore it.");
  }
  return profile;
}

async function requireAdmin(userId: string) {
  const profile = await requireProfile(userId);
  if (profile.role !== "admin" || !isFloorAdminEmail(profile.email)) {
    throw new Error("Admin only");
  }
  return profile;
}

async function logActivity(actorId: string, action: string, detail: string) {
  const sql = await getSql();
  await sql`
    insert into floor_activity (actor_id, action, detail)
    values (${actorId}, ${action}, ${detail})
  `;
}

async function ensureProfileFor(userId: string): Promise<Profile> {
  const existing = await getProfile(userId);
  if (existing) return existing;

  const sql = await getSql();
  const auth = await loadAuthUser(userId);
  const displayName = auth.name?.trim() || auth.email.split("@")[0] || "Rep";
  const role: FloorRole = isFloorAdminEmail(auth.email) ? "admin" : "salesman";

  await sql`
    insert into profiles (user_id, display_name, email, role, initials, monthly_goal, active)
    values (
      ${userId},
      ${displayName},
      ${auth.email || null},
      ${role},
      ${initialsFrom(displayName)},
      10,
      true
    )
    on conflict (user_id) do nothing
  `;

  const created = await getProfile(userId);
  if (!created) throw new Error("Could not create floor profile");
  await logActivity(
    userId,
    role === "admin" ? "opened the floor" : "joined the floor",
    role === "admin" ? `${displayName} · teamconnect admin` : displayName,
  );
  return created;
}

async function shoutTheFloor(actor: Profile, periodStart: string, periodEnd: string) {
  const sql = await getSql();
  const counts = await sql<{ user_id: string; display_name: string; n: number }>`
    select p.user_id, p.display_name, count(s.id)::int as n
    from profiles p
    left join sales s
      on s.user_id = p.user_id and s.sold_on >= ${periodStart} and s.sold_on <= ${periodEnd}
    where p.active = true
    group by p.user_id, p.display_name
  `;
  const mine = counts.find((r) => r.user_id === actor.userId);
  const myCount = toNum(mine?.n);
  const hunter = firstName(actor.displayName);
  const max = Math.max(0, ...counts.map((r) => toNum(r.n)));
  const leaders = counts.filter((r) => toNum(r.n) === max && max > 0);

  if (myCount > 0 && leaders.length === 1 && leaders[0].user_id === actor.userId) {
    await sql`
      insert into floor_alerts (actor_id, actor_name, target_id, message, kind)
      values (
        ${actor.userId},
        ${actor.displayName},
        null,
        ${`${hunter} just took the board with ${myCount}. Don't let them keep it.`},
        ${"lead"}
      )
    `;
  }

  for (const row of counts) {
    if (row.user_id === actor.userId) continue;
    const their = toNum(row.n);
    const gap = myCount - their;
    if (gap <= 0) continue;
    const message =
      gap === 1
        ? `Don't be beat by ${hunter}. Sell 1 more to catch up.`
        : `Don't be beat by ${hunter}. Sell ${gap} more to catch up.`;
    await sql`
      insert into floor_alerts (actor_id, actor_name, target_id, message, kind)
      values (
        ${actor.userId},
        ${actor.displayName},
        ${row.user_id},
        ${message},
        ${gap === 1 ? "catch" : "hunt"}
      )
    `;
  }
}

const CUSTOMER_SELECT = `c.id, c.owner_id, p.display_name as owner_name, c.name, c.phone, c.email, c.company, c.city,
  c.source, c.status, c.notes, c.next_follow_up, c.last_contacted, c.monthly_spend,
  c.current_provider, c.pain_notes, c.first_demo_on, c.created_at,
  c.sequence_key, c.sequence_started_on,
  (select count(*)::int from calls k where k.customer_id = c.id) as call_count,
  (select count(*)::int from sales s where s.customer_id = c.id) as sale_count,
  (select f.id from follow_up_steps f where f.customer_id = c.id and f.done_at is null and f.skipped_at is null order by f.step_index limit 1) as current_step_id,
  (select f.title from follow_up_steps f where f.customer_id = c.id and f.done_at is null and f.skipped_at is null order by f.step_index limit 1) as current_step_title,
  (select f.due_on from follow_up_steps f where f.customer_id = c.id and f.done_at is null and f.skipped_at is null order by f.step_index limit 1) as current_step_due,
  (select f.step_index from follow_up_steps f where f.customer_id = c.id and f.done_at is null and f.skipped_at is null order by f.step_index limit 1) as current_step_index`;

type StepRow = {
  id: number;
  customer_id: number;
  owner_id: string;
  sequence_key: string;
  step_index: number;
  title: string;
  action: string;
  due_on: string;
  done_at: string | null;
  skipped_at: string | null;
};

function mapStep(row: StepRow): FollowUpStep {
  return {
    id: toNum(row.id),
    customerId: toNum(row.customer_id),
    ownerId: row.owner_id,
    sequenceKey: row.sequence_key,
    stepIndex: toNum(row.step_index),
    title: row.title,
    action: row.action === "note" ? "note" : "call",
    dueOn: row.due_on,
    doneAt: row.done_at ? String(row.done_at) : null,
    skippedAt: row.skipped_at ? String(row.skipped_at) : null,
  };
}

async function syncNextFollowUp(customerId: number) {
  const sql = await getSql();
  const open = await sql<{ due_on: string }>`
    select due_on from follow_up_steps
    where customer_id = ${customerId} and done_at is null and skipped_at is null
    order by step_index
    limit 1
  `;
  const next = open[0]?.due_on ?? null;
  await sql`
    update customers set next_follow_up = ${next}, updated_at = now()
    where id = ${customerId}
  `;
  return next;
}

async function enrollCustomerSequence(
  customerId: number,
  ownerId: string,
  key: SequenceKey,
  startOn = todayIso(),
) {
  const sql = await getSql();
  const plan = buildSequencePlan(key, startOn);
  await sql`
    delete from follow_up_steps
    where customer_id = ${customerId} and done_at is null and skipped_at is null
  `;
  for (const step of plan) {
    await sql`
      insert into follow_up_steps (
        customer_id, owner_id, sequence_key, step_index, title, action, due_on
      ) values (
        ${customerId}, ${ownerId}, ${key}, ${step.index}, ${step.title}, ${step.action}, ${step.dueOn}
      )
    `;
  }
  await sql`
    update customers
    set sequence_key = ${key},
        sequence_started_on = ${startOn},
        next_follow_up = ${plan[0]?.dueOn ?? null},
        updated_at = now()
    where id = ${customerId}
  `;
}

async function stopCustomerSequence(customerId: number) {
  const sql = await getSql();
  await sql`
    update follow_up_steps
    set skipped_at = now()
    where customer_id = ${customerId} and done_at is null and skipped_at is null
  `;
  await sql`
    update customers
    set sequence_key = null,
        next_follow_up = null,
        updated_at = now()
    where id = ${customerId}
  `;
}

async function completeOpenStep(customerId: number) {
  const sql = await getSql();
  const open = await sql<{ id: number }>`
    select id from follow_up_steps
    where customer_id = ${customerId} and done_at is null and skipped_at is null
    order by step_index
    limit 1
  `;
  if (!open[0]) return null;
  await sql`update follow_up_steps set done_at = now() where id = ${open[0].id}`;
  await syncNextFollowUp(customerId);
  return toNum(open[0].id);
}

async function loadCustomers(whereSql: string, params: unknown[] = []) {
  const sql = await getSql();
  return sql.query<CustomerRow>(
    `select ${CUSTOMER_SELECT}
     from customers c
     join profiles p on p.user_id = c.owner_id
     ${whereSql}`,
    params,
  );
}

export const bootstrapFloor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await ensureProfileFor(context.userId);
    await healAdminSeats();
    return (await getProfile(context.userId)) ?? me;
  });

export const getDbStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    let ok = false;
    try {
      const sql = await getSql();
      await sql`select 1 as ok`;
      ok = true;
    } catch {
      ok = false;
    }
    return {
      backend: dbSource,
      persistent: dbSource === "neon",
      ok,
    };
  });

export const getFloorState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { period?: PeriodKey }) => ({
    period: (data?.period ?? "month") as PeriodKey,
  }))
  .handler(async ({ context, data }): Promise<FloorState> => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const range = periodRange(data.period);
    const today = todayIso();

    const peopleRows = await sql<ProfileRow>`
      select user_id, display_name, email, role, initials, monthly_goal, active, marker_color
      from profiles
      where active = true
      order by display_name asc
    `;

    const salesRows = await sql<SaleRow>`
      select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
             intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
             marker_color, stroke_json
      from sales
      where sold_on >= ${range.start} and sold_on <= ${range.end}
      order by sold_at asc
    `;

    const month = periodRange("month");
    const monthRows = await sql<SaleRow>`
      select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
             intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
             marker_color, stroke_json
      from sales
      where sold_on >= ${month.start} and sold_on <= ${month.end}
      order by sold_on asc, sold_at asc
    `;
    const lifeRows = await sql<SaleRow>`
      select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
             intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
             marker_color, stroke_json
      from sales
      order by sold_on asc, sold_at asc
    `;

    const todaySales = await sql<{ user_id: string; n: number }>`
      select user_id, count(*)::int as n from sales
      where sold_on = ${today}
      group by user_id
    `;
    const callCounts = await sql<{ user_id: string; n: number }>`
      select user_id, count(*)::int as n from calls
      where called_on >= ${range.start} and called_on <= ${range.end}
      group by user_id
    `;
    const dueCounts = await sql<{ owner_id: string; n: number }>`
      select owner_id, count(*)::int as n from customers
      where next_follow_up is not null and next_follow_up <= ${today}
        and status not in ('sold', 'dead')
      group by owner_id
    `;
    const statusCounts = await sql<{ owner_id: string; status: string; n: number }>`
      select owner_id, status, count(*)::int as n from customers
      group by owner_id, status
    `;

    const todayMap = new Map(todaySales.map((r) => [r.user_id, toNum(r.n)]));
    const callMap = new Map(callCounts.map((r) => [r.user_id, toNum(r.n)]));
    const dueMap = new Map(dueCounts.map((r) => [r.owner_id, toNum(r.n)]));
    const statusByUser = new Map<string, Record<string, number>>();
    for (const row of statusCounts) {
      const bag = statusByUser.get(row.owner_id) ?? {};
      bag[row.status] = toNum(row.n);
      statusByUser.set(row.owner_id, bag);
    }
    const presenceRows = await sql.query<{
      user_id: string;
      status: string;
      note: string | null;
      until_on: string | null;
    }>(
      `select user_id, status, note, until_on from desk_presence
       where status in ('sick','off') and (until_on is null or until_on >= $1)`,
      [today],
    );
    const offRows = await sql.query<{
      user_id: string;
      kind: string;
      end_on: string;
      note: string | null;
    }>(
      `select user_id, kind, end_on, note from time_requests
       where status = 'approved' and start_on <= $1 and end_on >= $1`,
      [today],
    );
    const outMap = new Map<string, { kind: "sick" | "off"; untilOn: string | null; note: string }>();
    for (const row of offRows) {
      outMap.set(row.user_id, {
        kind: row.kind === "sick" ? "sick" : "off",
        untilOn: row.end_on,
        note: row.note ?? "",
      });
    }
    for (const row of presenceRows) {
      outMap.set(row.user_id, {
        kind: row.status === "sick" ? "sick" : "off",
        untilOn: row.until_on,
        note: row.note ?? "",
      });
    }

    const salesByUser = new Map<string, Sale[]>();
    for (const row of salesRows) {
      const list = salesByUser.get(row.user_id) ?? [];
      list.push(mapSale(row));
      salesByUser.set(row.user_id, list);
    }
    const monthByUser = new Map<string, Sale[]>();
    for (const row of monthRows) {
      const list = monthByUser.get(row.user_id) ?? [];
      list.push(mapSale(row));
      monthByUser.set(row.user_id, list);
    }
    const lifeByUser = new Map<string, Sale[]>();
    for (const row of lifeRows) {
      const list = lifeByUser.get(row.user_id) ?? [];
      list.push(mapSale(row));
      lifeByUser.set(row.user_id, list);
    }

    const people: PersonColumn[] = peopleRows.map((row) => {
      const profile = mapProfile(row);
      const monthSales = monthByUser.get(row.user_id) ?? [];
      const life = lifeByUser.get(row.user_id) ?? [];
      const pay = computePay(monthSales, life);
      const conv = buildRepConversion({
        userId: row.user_id,
        name: profile.displayName,
        statuses: statusByUser.get(row.user_id) ?? {},
        calls: Array.from({ length: callMap.get(row.user_id) ?? 0 }, () => ({ outcome: "no_answer" })),
        sales: monthSales.length,
      });
      return {
        ...profile,
        sales: salesByUser.get(row.user_id) ?? [],
        periodCount: (salesByUser.get(row.user_id) ?? []).length,
        todayCount: todayMap.get(row.user_id) ?? 0,
        callCount: callMap.get(row.user_id) ?? 0,
        followUpsDue: dueMap.get(row.user_id) ?? 0,
        monthPay: pay.net,
        tierRate: pay.rate,
        closeRate: conv.closeRate || conv.leadRate,
        out: outMap.get(row.user_id) ?? null,
      };
    });

    people.sort((a, b) => b.periodCount - a.periodCount || a.displayName.localeCompare(b.displayName));

    const alertRows = await sql<{
      id: number;
      actor_id: string;
      actor_name: string;
      target_id: string | null;
      message: string;
      kind: string;
      created_at: string;
    }>`
      select id, actor_id, actor_name, target_id, message, kind, created_at
      from floor_alerts
      where target_id = ${me.userId} or target_id is null
      order by created_at desc
      limit 16
    `;

    return {
      me,
      people,
      period: { key: data.period, ...range },
      alerts: alertRows.map(mapAlert),
    };
  });

export const getConversion = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { period?: PeriodKey }) => ({
    period: (data?.period ?? "month") as PeriodKey,
  }))
  .handler(async ({ context, data }): Promise<{
    me: Profile;
    period: { key: PeriodKey; start: string; end: string; label: string };
    mine: RepConversion;
    floor: RepConversion;
    people: RepConversion[];
  }> => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const range = periodRange(data.period);
    const peopleRows = await sql<ProfileRow>`
      select user_id, display_name, email, role, initials, monthly_goal, active, marker_color
      from profiles where active = true order by display_name
    `;
    const statusRows = await sql.query<{ owner_id: string; status: string; n: number }>(
      `select owner_id, status, count(*)::int as n
       from customers c
       where c.created_at::date >= $1
          or (c.last_contacted is not null and c.last_contacted >= $1)
          or exists (
            select 1 from sales s
            where s.customer_id = c.id and s.sold_on >= $1 and s.sold_on <= $2
          )
       group by owner_id, status`,
      [range.start, range.end],
    );
    const callRows = await sql<{ user_id: string; outcome: string }>`
      select user_id, outcome from calls
      where called_on >= ${range.start} and called_on <= ${range.end}
    `;
    const saleRows = await sql<{ user_id: string; n: number }>`
      select user_id, count(*)::int as n from sales
      where sold_on >= ${range.start} and sold_on <= ${range.end}
      group by user_id
    `;
    const statusBy = new Map<string, Record<string, number>>();
    for (const row of statusRows) {
      const bag = statusBy.get(row.owner_id) ?? {};
      bag[row.status] = toNum(row.n);
      statusBy.set(row.owner_id, bag);
    }
    const callsBy = new Map<string, Array<{ outcome: string }>>();
    for (const row of callRows) {
      const list = callsBy.get(row.user_id) ?? [];
      list.push({ outcome: row.outcome });
      callsBy.set(row.user_id, list);
    }
    const salesBy = new Map(saleRows.map((r) => [r.user_id, toNum(r.n)]));
    const people = peopleRows.map((row) =>
      buildRepConversion({
        userId: row.user_id,
        name: row.display_name,
        statuses: statusBy.get(row.user_id) ?? {},
        calls: callsBy.get(row.user_id) ?? [],
        sales: salesBy.get(row.user_id) ?? 0,
      }),
    );
    people.sort((a, b) => b.closeRate - a.closeRate || b.sold - a.sold || a.name.localeCompare(b.name));
    const floor = mergeConversions("Floor", people);
    const mine = people.find((p) => p.userId === me.userId) ??
      buildRepConversion({
        userId: me.userId,
        name: me.displayName,
        statuses: {},
        calls: [],
        sales: 0,
      });
    return {
      me,
      period: { key: data.period, ...range },
      mine,
      floor,
      people,
    };
  });

export const getMyDay = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DayState> => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const today = todayIso();
    const month = periodRange("month");
    const week = periodRange("week");

    const todaySales = await sql<SaleRow>`
      select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
             intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
             marker_color, stroke_json
      from sales where user_id = ${me.userId} and sold_on = ${today}
      order by sold_at desc
    `;

    const todayCalls = await sql<CallRow>`
      select c.id, c.user_id, p.display_name as user_name, c.customer_id,
             cu.name as customer_name, c.called_on, c.called_at, c.outcome, c.notes
      from calls c
      join profiles p on p.user_id = c.user_id
      left join customers cu on cu.id = c.customer_id
      where c.user_id = ${me.userId} and c.called_on = ${today}
      order by c.called_at desc
    `;

    const followUps = await loadCustomers(
      `where c.owner_id = $1
        and c.next_follow_up is not null and c.next_follow_up <= $2
        and c.status not in ('sold', 'dead')
      order by c.next_follow_up asc`,
      [me.userId, today],
    );

    const monthCount = await sql<{ n: number }>`
      select count(*)::int as n from sales
      where user_id = ${me.userId} and sold_on >= ${month.start} and sold_on <= ${month.end}
    `;
    const weekCount = await sql<{ n: number }>`
      select count(*)::int as n from sales
      where user_id = ${me.userId} and sold_on >= ${week.start} and sold_on <= ${week.end}
    `;

    return {
      me,
      todaySales: todaySales.map(mapSale),
      todayCalls: todayCalls.map(mapCall),
      followUps: followUps.map(mapCustomer),
      monthCount: toNum(monthCount[0]?.n),
      monthGoal: me.monthlyGoal,
      weekCount: toNum(weekCount[0]?.n),
    };
  });

export const postSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    userId?: string;
    customerName?: string;
    dealValue?: number;
    notes?: string;
    soldOn?: string;
    intelligence?: boolean;
    painKiller?: boolean;
    speedClose?: boolean;
    firstDemoOn?: string;
    customerId?: number;
    markerColor?: string;
    strokeJson?: string;
  }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const targetId = data.userId ?? me.userId;
    if (targetId !== me.userId && me.role !== "admin") {
      throw new Error("Only an admin can post an X for someone else");
    }
    const sql = await getSql();
    const target = await getProfile(targetId);
    if (!target || !target.active) throw new Error("That rep is not on the floor");

    const soldOn = isIsoDay(data.soldOn) ? data.soldOn : todayIso();
    const dealValue = Number.isFinite(data.dealValue) ? Number(data.dealValue) : 4995;
    const customerName = data.customerName?.trim() || null;
    const notes = data.notes?.trim() || null;
    const firstDemoOn = isIsoDay(data.firstDemoOn) ? data.firstDemoOn : null;
    const speedClose = Boolean(data.speedClose) || speedFromDemo(firstDemoOn, soldOn);
    const customerId = data.customerId && Number.isFinite(data.customerId) ? data.customerId : null;
    const markerColor = data.markerColor?.trim() || target.markerColor || DEFAULT_MARKER;
    const parsed = parseStrokes(data.strokeJson ?? null, markerColor);
    if (!hasDrawnX(parsed)) {
      throw new Error("Pick a marker and draw your X on the board");
    }
    const strokeJson = data.strokeJson ?? null;

    const inserted = await sql<SaleRow>`
      insert into sales (
        user_id, customer_id, customer_name, deal_value, notes, sold_on, created_by,
        intelligence, pain_killer, speed_close, first_demo_on, marker_color, stroke_json
      )
      values (
        ${targetId}, ${customerId}, ${customerName}, ${dealValue}, ${notes}, ${soldOn}, ${me.userId},
        ${Boolean(data.intelligence)}, ${Boolean(data.painKiller)}, ${speedClose}, ${firstDemoOn},
        ${markerColor}, ${strokeJson}
      )
      returning id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
                intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
                marker_color, stroke_json
    `;

    await sql`
      update profiles set marker_color = ${markerColor}, updated_at = now()
      where user_id = ${targetId}
    `;

    if (customerId) {
      await sql`
        update customers
        set status = 'sold',
            last_contacted = ${soldOn},
            updated_at = now()
        where id = ${customerId}
      `;
    }

    const who = targetId === me.userId ? me.displayName : target.displayName;
    const override = targetId !== me.userId ? ` (posted by ${me.displayName})` : "";
    await logActivity(me.userId, "posted an X", `${who}${override}`);
    const month = periodRange("month");
    await shoutTheFloor({ ...target, markerColor }, month.start, month.end);
    const books = await loadPayBooks(targetId);
    const posted = mapSale(inserted[0]);
    const quote = quoteClose(books.month, books.life, {
      dealValue: posted.dealValue,
      intelligence: posted.intelligence,
      painKiller: posted.painKiller,
      speedClose: posted.speedClose,
      soldOn: posted.soldOn,
    }, posted.id);
    return {
      ...posted,
      quote,
      pay: computePay(books.month, books.life),
    } satisfies PostedSale;
  });

export const updateSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    id: number;
    customerName?: string;
    dealValue?: number;
    notes?: string;
    soldOn?: string;
    intelligence?: boolean;
    painKiller?: boolean;
    speedClose?: boolean;
    firstDemoOn?: string;
    refunded?: boolean;
    markerColor?: string;
    strokeJson?: string;
  }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<SaleRow>`
      select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
             intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
             marker_color, stroke_json
      from sales where id = ${data.id} limit 1
    `;
    const sale = rows[0];
    if (!sale) throw new Error("Sale not found");
    if (sale.user_id !== me.userId && me.role !== "admin") {
      throw new Error("You can only edit your own X");
    }

    const customerName = data.customerName?.trim() || null;
    const notes = data.notes?.trim() || null;
    const dealValue = Number.isFinite(data.dealValue) ? Number(data.dealValue) : toNum(sale.deal_value);
    const soldOn = isIsoDay(data.soldOn) ? data.soldOn : sale.sold_on;
    const firstDemoOn = isIsoDay(data.firstDemoOn) ? data.firstDemoOn : sale.first_demo_on;
    const intelligence = data.intelligence ?? Boolean(sale.intelligence);
    const painKiller = data.painKiller ?? Boolean(sale.pain_killer);
    const speedClose = Boolean(data.speedClose) || speedFromDemo(firstDemoOn, soldOn);
    const refunded = me.role === "admin" ? (data.refunded ?? Boolean(sale.refunded)) : Boolean(sale.refunded);
    const refundedAt = refunded ? (sale.refunded_at ?? new Date().toISOString()) : null;

    const updated = await sql<SaleRow>`
      update sales
      set customer_name = ${customerName},
          deal_value = ${dealValue},
          notes = ${notes},
          sold_on = ${soldOn},
          intelligence = ${intelligence},
          pain_killer = ${painKiller},
          speed_close = ${speedClose},
          first_demo_on = ${firstDemoOn},
          refunded = ${refunded},
          refunded_at = ${refundedAt},
          updated_at = now()
      where id = ${data.id}
      returning id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
                intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
                marker_color, stroke_json
    `;
    await logActivity(me.userId, "edited an X", `${me.displayName} updated sale #${data.id}`);
    const mapped = mapSale(updated[0]);
    const books = await loadPayBooks(mapped.userId);
    return {
      ...mapped,
      pay: computePay(books.month, books.life),
    };
  });

export const deleteSale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: number }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<{ id: number; user_id: string }>`
      select id, user_id from sales where id = ${data.id} limit 1
    `;
    const sale = rows[0];
    if (!sale) throw new Error("Sale not found");
    if (sale.user_id !== me.userId && me.role !== "admin") {
      throw new Error("You can only pull your own X");
    }
    await sql`delete from sales where id = ${data.id}`;
    await logActivity(me.userId, "pulled an X", `${me.displayName} pulled sale #${data.id}`);
    return { ok: true };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { scope?: "mine" | "all"; filter?: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const all = data.scope === "all" && me.role === "admin";
    const rows = all
      ? await loadCustomers("order by c.updated_at desc")
      : await loadCustomers("where c.owner_id = $1 order by c.updated_at desc", [me.userId]);
    const seatRows = await sql<{ user_id: string; display_name: string }>`
      select user_id, display_name from profiles where active = true order by display_name
    `;
    const seats: Seat[] = seatRows.map((r) => ({ userId: r.user_id, displayName: r.display_name }));
    return { me, seats, customers: rows.map(mapCustomer) };
  });

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    id?: number;
    name: string;
    phone?: string;
    email?: string;
    company?: string;
    city?: string;
    source?: LeadSource;
    status?: CustomerStatus;
    notes?: string;
    nextFollowUp?: string | null;
    ownerId?: string;
    monthlySpend?: number | null;
    currentProvider?: string;
    painNotes?: string;
    firstDemoOn?: string | null;
    sequenceKey?: string | null;
  }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    const ownerId = me.role === "admin" && data.ownerId ? data.ownerId : me.userId;
    const status = data.status ?? "new";
    const nextFollowUp = data.nextFollowUp && /^\d{4}-\d{2}-\d{2}$/.test(data.nextFollowUp)
      ? data.nextFollowUp
      : null;
    const firstDemoOn = data.firstDemoOn && /^\d{4}-\d{2}-\d{2}$/.test(data.firstDemoOn)
      ? data.firstDemoOn
      : null;
    const monthlySpend =
      data.monthlySpend != null && Number.isFinite(data.monthlySpend) ? data.monthlySpend : null;
    const sequenceKey = isSequenceKey(data.sequenceKey) ? data.sequenceKey : null;
    const startOn = nextFollowUp ?? todayIso();

    if (data.id) {
      const existing = await sql<{ owner_id: string; sequence_key: string | null; next_follow_up: string | null }>`
        select owner_id, sequence_key, next_follow_up from customers where id = ${data.id} limit 1
      `;
      if (!existing[0]) throw new Error("Customer not found");
      if (existing[0].owner_id !== me.userId && me.role !== "admin") {
        throw new Error("That record is on another desk");
      }
      await sql`
        update customers
        set name = ${name},
            phone = ${data.phone?.trim() || null},
            email = ${data.email?.trim() || null},
            company = ${data.company?.trim() || null},
            city = ${data.city?.trim() || null},
            source = ${data.source || null},
            status = ${status},
            notes = ${data.notes?.trim() || null},
            next_follow_up = ${nextFollowUp},
            owner_id = ${ownerId},
            monthly_spend = ${monthlySpend},
            current_provider = ${data.currentProvider?.trim() || null},
            pain_notes = ${data.painNotes?.trim() || null},
            first_demo_on = ${firstDemoOn},
            updated_at = now()
        where id = ${data.id}
      `;
      if (status === "sold" || status === "dead") {
        await stopCustomerSequence(data.id);
      } else if (status === "booked" && existing[0].sequence_key !== "booked") {
        await enrollCustomerSequence(data.id, ownerId, "booked", todayIso());
      } else if (sequenceKey && sequenceKey !== existing[0].sequence_key) {
        await enrollCustomerSequence(data.id, ownerId, sequenceKey, startOn);
      } else if (data.sequenceKey === "" || data.sequenceKey === "none") {
        await stopCustomerSequence(data.id);
      } else if (nextFollowUp && nextFollowUp !== existing[0].next_follow_up) {
        await sql`
          update follow_up_steps
          set due_on = ${nextFollowUp}
          where id = (
            select id from follow_up_steps
            where customer_id = ${data.id} and done_at is null and skipped_at is null
            order by step_index limit 1
          )
        `;
      }
      const rows = await loadCustomers("where c.id = $1", [data.id]);
      return mapCustomer(rows[0]);
    }

    const inserted = await sql<{ id: number }>`
      insert into customers (
        owner_id, name, phone, email, company, city, source, status, notes,
        next_follow_up, monthly_spend, current_provider, pain_notes, first_demo_on
      )
      values (
        ${ownerId}, ${name}, ${data.phone?.trim() || null}, ${data.email?.trim() || null},
        ${data.company?.trim() || null}, ${data.city?.trim() || null}, ${data.source || null},
        ${status}, ${data.notes?.trim() || null}, ${nextFollowUp}, ${monthlySpend},
        ${data.currentProvider?.trim() || null}, ${data.painNotes?.trim() || null}, ${firstDemoOn}
      )
      returning id
    `;
    const rows = await loadCustomers("where c.id = $1", [inserted[0].id]);
    if (sequenceKey) {
      await enrollCustomerSequence(inserted[0].id, ownerId, sequenceKey, startOn);
    } else if (data.sequenceKey === "none") {
      // one-off date only
    } else if (status === "booked") {
      await enrollCustomerSequence(inserted[0].id, ownerId, "booked", startOn);
    } else if (status !== "sold" && status !== "dead") {
      await enrollCustomerSequence(inserted[0].id, ownerId, "hunt", startOn);
    }
    await logActivity(me.userId, "added a record", name);
    const fresh = await loadCustomers("where c.id = $1", [inserted[0].id]);
    return mapCustomer(fresh[0]);
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: number }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const existing = await sql<{ owner_id: string; name: string }>`
      select owner_id, name from customers where id = ${data.id} limit 1
    `;
    if (!existing[0]) throw new Error("Customer not found");
    if (existing[0].owner_id !== me.userId && me.role !== "admin") {
      throw new Error("That record is on another desk");
    }
    await sql`delete from customers where id = ${data.id}`;
    await logActivity(me.userId, "removed a record", existing[0].name);
    return { ok: true };
  });

export const moveCustomerStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: number; status: CustomerStatus }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const existing = await sql<{ owner_id: string; name: string }>`
      select owner_id, name from customers where id = ${data.id} limit 1
    `;
    if (!existing[0]) throw new Error("Customer not found");
    if (existing[0].owner_id !== me.userId && me.role !== "admin") {
      throw new Error("That record is on another desk");
    }
    await sql`
      update customers set status = ${data.status}, updated_at = now() where id = ${data.id}
    `;
    if (data.status === "sold" || data.status === "dead") {
      await stopCustomerSequence(data.id);
    } else if (data.status === "booked") {
      await enrollCustomerSequence(data.id, existing[0].owner_id, "booked", todayIso());
    } else if (data.status === "follow_up" || data.status === "contacted" || data.status === "new") {
      const current = await sql<{ sequence_key: string | null }>`
        select sequence_key from customers where id = ${data.id} limit 1
      `;
      if (!isSequenceKey(current[0]?.sequence_key)) {
        await enrollCustomerSequence(data.id, existing[0].owner_id, "hunt", todayIso());
      }
    }
    return { ok: true };
  });

export const getCustomerRecord = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { id: number }) => data)
  .handler(async ({ context, data }): Promise<{ me: Profile; seats: Seat[]; record: CustomerRecord }> => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await loadCustomers("where c.id = $1", [data.id]);
    if (!rows[0]) throw new Error("Customer not found");
    if (rows[0].owner_id !== me.userId && me.role !== "admin") {
      throw new Error("That record is on another desk");
    }
    const notes = await sql<{
      id: number;
      customer_id: number;
      author_id: string;
      author_name: string;
      body: string;
      created_at: string;
    }>`
      select n.id, n.customer_id, n.author_id, p.display_name as author_name, n.body, n.created_at
      from customer_notes n
      join profiles p on p.user_id = n.author_id
      where n.customer_id = ${data.id}
      order by n.created_at desc
    `;
    const calls = await sql<CallRow>`
      select c.id, c.user_id, p.display_name as user_name, c.customer_id,
             cu.name as customer_name, c.called_on, c.called_at, c.outcome, c.notes
      from calls c
      join profiles p on p.user_id = c.user_id
      left join customers cu on cu.id = c.customer_id
      where c.customer_id = ${data.id}
      order by c.called_at desc
    `;
    const sales = await sql<SaleRow>`
      select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
             intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
             marker_color, stroke_json
      from sales where customer_id = ${data.id}
      order by sold_at desc
    `;
    const steps = await sql<StepRow>`
      select id, customer_id, owner_id, sequence_key, step_index, title, action, due_on, done_at, skipped_at
      from follow_up_steps
      where customer_id = ${data.id}
      order by step_index
    `;
    const seatRows = await sql<{ user_id: string; display_name: string }>`
      select user_id, display_name from profiles where active = true order by display_name
    `;
    return {
      me,
      seats: seatRows.map((r) => ({ userId: r.user_id, displayName: r.display_name })),
      record: {
        customer: mapCustomer(rows[0]),
        notes: notes.map((n) => ({
          id: toNum(n.id),
          customerId: toNum(n.customer_id),
          authorId: n.author_id,
          authorName: n.author_name,
          body: n.body,
          createdAt: String(n.created_at),
        })) satisfies CustomerNote[],
        calls: calls.map(mapCall),
        sales: sales.map(mapSale),
        steps: steps.map(mapStep),
      },
    };
  });

export const addCustomerNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { customerId: number; body: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const body = data.body.trim();
    if (!body) throw new Error("Note is empty");
    const existing = await sql<{ owner_id: string }>`
      select owner_id from customers where id = ${data.customerId} limit 1
    `;
    if (!existing[0]) throw new Error("Customer not found");
    if (existing[0].owner_id !== me.userId && me.role !== "admin") {
      throw new Error("That record is on another desk");
    }
    await sql`
      insert into customer_notes (customer_id, author_id, body)
      values (${data.customerId}, ${me.userId}, ${body})
    `;
    return { ok: true };
  });

export const enrollSequence = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { customerId: number; key: SequenceKey; startOn?: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<{ owner_id: string; name: string }>`
      select owner_id, name from customers where id = ${data.customerId} limit 1
    `;
    if (!rows[0]) throw new Error("Customer not found");
    if (rows[0].owner_id !== me.userId && me.role !== "admin") {
      throw new Error("That record is on another desk");
    }
    const startOn = isIsoDay(data.startOn) ? data.startOn : todayIso();
    await enrollCustomerSequence(data.customerId, rows[0].owner_id, data.key, startOn);
    const def = sequenceOf(data.key);
    await logActivity(me.userId, "started a sequence", `${rows[0].name} · ${def?.name ?? data.key}`);
    return { ok: true };
  });

export const completeFollowUpStep = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: number }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<StepRow & { customer_name: string }>`
      select f.id, f.customer_id, f.owner_id, f.sequence_key, f.step_index, f.title, f.action,
             f.due_on, f.done_at, f.skipped_at, c.name as customer_name
      from follow_up_steps f
      join customers c on c.id = f.customer_id
      where f.id = ${data.id}
      limit 1
    `;
    const step = rows[0];
    if (!step) throw new Error("Step not found");
    if (step.owner_id !== me.userId && me.role !== "admin") {
      throw new Error("That sequence is on another desk");
    }
    await sql`update follow_up_steps set done_at = now(), skipped_at = null where id = ${data.id}`;
    await syncNextFollowUp(toNum(step.customer_id));
    await logActivity(me.userId, "hit a follow-up", `${step.customer_name} · ${step.title}`);
    return { ok: true };
  });

export const skipFollowUpStep = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: number }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<StepRow>`
      select id, customer_id, owner_id, sequence_key, step_index, title, action, due_on, done_at, skipped_at
      from follow_up_steps where id = ${data.id} limit 1
    `;
    const step = rows[0];
    if (!step) throw new Error("Step not found");
    if (step.owner_id !== me.userId && me.role !== "admin") {
      throw new Error("That sequence is on another desk");
    }
    await sql`update follow_up_steps set skipped_at = now() where id = ${data.id}`;
    await syncNextFollowUp(toNum(step.customer_id));
    return { ok: true };
  });

export const listSequenceDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { scope?: "due" | "upcoming" | "all" }) => data)
  .handler(async ({ context, data }): Promise<{
    me: Profile;
    due: SequenceTask[];
    upcoming: SequenceTask[];
  }> => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const today = todayIso();
    const mine = me.role === "admin" ? "" : "and f.owner_id = $2";
    const paramsDue = me.role === "admin" ? [today] : [today, me.userId];
    const paramsUp = me.role === "admin" ? [today] : [today, me.userId];
    const taskSelect = `f.id, f.customer_id, f.owner_id, f.sequence_key, f.step_index, f.title, f.action,
      f.due_on, f.done_at, f.skipped_at, c.name as customer_name, c.company, c.phone,
      p.display_name as owner_name,
      (select count(*)::int from follow_up_steps s where s.customer_id = f.customer_id and s.sequence_key = f.sequence_key) as total_steps`;
    const dueRows = await sql.query<StepRow & {
      customer_name: string;
      company: string | null;
      phone: string | null;
      owner_name: string;
      total_steps: number;
    }>(
      `select ${taskSelect}
       from follow_up_steps f
       join customers c on c.id = f.customer_id
       join profiles p on p.user_id = f.owner_id
       where f.done_at is null and f.skipped_at is null and f.due_on <= $1
         and c.status not in ('sold', 'dead')
         ${mine}
       order by f.due_on, c.name`,
      paramsDue,
    );
    const upRows = await sql.query<StepRow & {
      customer_name: string;
      company: string | null;
      phone: string | null;
      owner_name: string;
      total_steps: number;
    }>(
      `select ${taskSelect}
       from follow_up_steps f
       join customers c on c.id = f.customer_id
       join profiles p on p.user_id = f.owner_id
       where f.done_at is null and f.skipped_at is null and f.due_on > $1
         and c.status not in ('sold', 'dead')
         ${mine}
       order by f.due_on, c.name`,
      paramsUp,
    );
    const toTask = (row: typeof dueRows[number]): SequenceTask => ({
      ...mapStep(row),
      customerName: row.customer_name,
      company: row.company,
      phone: row.phone,
      ownerName: row.owner_name,
      totalSteps: toNum(row.total_steps),
    });
    void data.scope;
    return { me, due: dueRows.map(toTask), upcoming: upRows.map(toTask) };
  });

export const logCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    customerId?: number;
    customerName: string;
    outcome: Call["outcome"];
    notes?: string;
    nextFollowUp?: string | null;
    status?: CustomerStatus;
    advanceSequence?: boolean;
  }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const sql = await getSql();
    const today = todayIso();
    let customerId = data.customerId ?? null;
    const name = data.customerName.trim();
    if (!customerId && name) {
      const created = await sql<{ id: number }>`
        insert into customers (owner_id, name, status, last_contacted)
        values (${me.userId}, ${name}, ${data.status ?? "contacted"}, ${today})
        returning id
      `;
      customerId = created[0].id;
    }
    await sql`
      insert into calls (user_id, customer_id, called_on, outcome, notes)
      values (${me.userId}, ${customerId}, ${today}, ${data.outcome}, ${data.notes?.trim() || null})
    `;
    if (customerId) {
      await sql`
        update customers
        set last_contacted = ${today},
            status = ${data.status ?? "contacted"},
            updated_at = now()
        where id = ${customerId}
      `;
      if (data.advanceSequence !== false) {
        await completeOpenStep(customerId);
      } else if (isIsoDay(data.nextFollowUp)) {
        await sql`
          update follow_up_steps
          set due_on = ${data.nextFollowUp}
          where id = (
            select id from follow_up_steps
            where customer_id = ${customerId} and done_at is null and skipped_at is null
            order by step_index limit 1
          )
        `;
        await sql`
          update customers set next_follow_up = ${data.nextFollowUp}, updated_at = now()
          where id = ${customerId}
        `;
      }
      if (data.status === "sold" || data.status === "dead") {
        await stopCustomerSequence(customerId);
      } else if (data.status === "booked") {
        const row = await sql<{ owner_id: string; sequence_key: string | null }>`
          select owner_id, sequence_key from customers where id = ${customerId} limit 1
        `;
        if (row[0] && row[0].sequence_key !== "booked") {
          await enrollCustomerSequence(customerId, row[0].owner_id, "booked", today);
        }
      }
    }
    await logActivity(me.userId, "logged a call", name || "Call");
    return { ok: true };
  });

export const getPayStatement = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { userId?: string }) => data)
  .handler(async ({ context, data }): Promise<{
    me: Profile;
    target: Profile;
    pay: PayStatement;
    month: Sale[];
    life: Sale[];
  }> => {
    const me = await requireProfile(context.userId);
    const targetId = data.userId && me.role === "admin" ? data.userId : me.userId;
    const target = await getProfile(targetId);
    if (!target) throw new Error("Rep not found");
    const books = await loadPayBooks(targetId);
    return {
      me,
      target,
      pay: computePay(books.month, books.life),
      month: books.month,
      life: books.life,
    };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireAdmin(context.userId);
    await healAdminSeats();
    const sql = await getSql();
    const month = periodRange("month");
    const today = todayIso();
    const rows = await sql<
      ProfileRow & { month_sales: number; today_sales: number; month_calls: number }
    >`
      select p.user_id, p.display_name, p.email, p.role, p.initials, p.monthly_goal, p.active,
             p.marker_color,
        (select count(*)::int from sales s where s.user_id = p.user_id and s.sold_on >= ${month.start} and s.sold_on <= ${month.end}) as month_sales,
        (select count(*)::int from sales s where s.user_id = p.user_id and s.sold_on = ${today}) as today_sales,
        (select count(*)::int from calls c where c.user_id = p.user_id and c.called_on >= ${month.start} and c.called_on <= ${month.end}) as month_calls
      from profiles p
      order by p.display_name
    `;
    const monthRows = await sql<SaleRow>`
      select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
             intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
             marker_color, stroke_json
      from sales
      where sold_on >= ${month.start} and sold_on <= ${month.end}
    `;
    const lifeRows = await sql<SaleRow>`
      select id, user_id, customer_id, customer_name, deal_value, notes, sold_on, sold_at, created_by,
             intelligence, pain_killer, speed_close, first_demo_on, refunded, refunded_at,
             marker_color, stroke_json
      from sales
    `;
    const monthByUser = new Map<string, Sale[]>();
    for (const row of monthRows) {
      const list = monthByUser.get(row.user_id) ?? [];
      list.push(mapSale(row));
      monthByUser.set(row.user_id, list);
    }
    const lifeByUser = new Map<string, Sale[]>();
    for (const row of lifeRows) {
      const list = lifeByUser.get(row.user_id) ?? [];
      list.push(mapSale(row));
      lifeByUser.set(row.user_id, list);
    }

    return {
      me,
      people: rows.map((row) => {
        const pay = computePay(monthByUser.get(row.user_id) ?? [], lifeByUser.get(row.user_id) ?? []);
        return {
          ...mapProfile(row),
          todaySales: toNum(row.today_sales),
          monthSales: toNum(row.month_sales),
          monthCalls: toNum(row.month_calls),
          monthPay: pay.net,
          tierLabel: pay.tierLabel,
          tierRate: pay.rate,
        };
      }),
    };
  });

export const updateTeammate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    userId: string;
    displayName?: string;
    role?: FloorRole;
    monthlyGoal?: number;
    active?: boolean;
  }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireAdmin(context.userId);
    const sql = await getSql();
    const current = await getProfile(data.userId);
    if (!current) throw new Error("Rep not found");

    const displayName = data.displayName?.trim() || current.displayName;
    const monthlyGoal =
      data.monthlyGoal != null && Number.isFinite(data.monthlyGoal)
        ? Math.max(1, Math.round(data.monthlyGoal))
        : current.monthlyGoal;
    const active = data.active ?? current.active;

    if (data.role && data.role !== current.role) {
      throw new Error(`${FLOOR_ADMIN_EMAIL} is the only admin seat`);
    }
    if (data.userId === me.userId && active === false) {
      throw new Error("You cannot deactivate yourself");
    }
    if (current.role === "admin" && active === false) {
      throw new Error("The teamconnect seat cannot be paused");
    }

    await sql`
      update profiles
      set display_name = ${displayName},
          initials = ${initialsFrom(displayName)},
          monthly_goal = ${monthlyGoal},
          active = ${active},
          updated_at = now()
      where user_id = ${data.userId}
    `;
    await logActivity(
      me.userId,
      "updated a teammate",
      `${displayName}${active ? "" : " · paused"}`,
    );
    return getProfile(data.userId);
  });

export const listActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ActivityRow[]> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      actor_id: string;
      actor_name: string | null;
      action: string;
      detail: string | null;
      created_at: string;
    }>`
      select a.id, a.actor_id, p.display_name as actor_name, a.action, a.detail, a.created_at
      from floor_activity a
      left join profiles p on p.user_id = a.actor_id
      order by a.created_at desc
      limit 40
    `;
    return rows.map((r) => ({
      id: toNum(r.id),
      actorId: r.actor_id,
      actorName: r.actor_name ?? "Rep",
      action: r.action,
      detail: r.detail,
      createdAt: String(r.created_at),
    }));
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { displayName?: string; monthlyGoal?: number }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireProfile(context.userId);
    const displayName = data.displayName?.trim();
    const nextName = displayName || me.displayName;
    if (!nextName) throw new Error("Name is required");
    let monthlyGoal = me.monthlyGoal;
    if (data.monthlyGoal != null) {
      if (!Number.isFinite(data.monthlyGoal)) throw new Error("Goal must be a number");
      monthlyGoal = Math.max(1, Math.min(99, Math.round(data.monthlyGoal)));
    }
    const sql = await getSql();
    await sql`
      update profiles
      set display_name = ${nextName},
          initials = ${initialsFrom(nextName)},
          monthly_goal = ${monthlyGoal},
          updated_at = now()
      where user_id = ${me.userId}
    `;
    if (data.monthlyGoal != null) {
      await logActivity(me.userId, "set a monthly goal", `${nextName} · ${monthlyGoal} X`);
    }
    return getProfile(me.userId);
  });
