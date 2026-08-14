import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { todayIso, toIsoDay } from "./period";
import { isFloorAdminEmail } from "./admin";
import {
  type BankPublic,
  type DeskMessage,
  type DeskProfile,
  type DeskThread,
  type FormStatus,
  type MsgTopic,
  type Presence,
  type RequestStatus,
  type TaxClass,
  type TimeKind,
  type TimeRequest,
  type W9Public,
  digitsOnly,
  validateRouting,
  validateTin,
  buildChecklist,
  maskTin,
  TAX_CLASS,
} from "./desk";
import { getProfileForDesk, requireDeskAdmin, requireDeskProfile } from "./desk-access";

function str(v: unknown) {
  return v == null ? "" : String(v);
}

function mapDeskProfile(row: {
  user_id: string;
  display_name: string;
  email: string | null;
  legal_name: string | null;
  phone: string | null;
  city: string | null;
  bio: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  work_hours: string | null;
  monthly_goal: number;
  marker_color: string | null;
  ic_signed_at: string | null;
  pay_plan_signed_at: string | null;
  onboarded_at?: string | null;
}): DeskProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    legalName: row.legal_name ?? "",
    phone: row.phone ?? "",
    city: row.city ?? "",
    bio: row.bio ?? "",
    emergencyName: row.emergency_name ?? "",
    emergencyPhone: row.emergency_phone ?? "",
    workHours: row.work_hours ?? "",
    monthlyGoal: Number(row.monthly_goal) || 10,
    markerColor: row.marker_color || "#0077c8",
    icSignedAt: row.ic_signed_at ? String(row.ic_signed_at) : null,
    payPlanSignedAt: row.pay_plan_signed_at ? String(row.pay_plan_signed_at) : null,
    onboardedAt: row.onboarded_at ? String(row.onboarded_at) : null,
  };
}

function mapW9(row: Record<string, unknown>, revealTin: boolean): W9Public {
  const tinType = row.tin_type === "ein" ? "ein" : "ssn";
  return {
    legalName: str(row.legal_name),
    businessName: str(row.business_name),
    taxClass: (str(row.tax_class) || "individual") as TaxClass,
    llcTaxClass: str(row.llc_tax_class),
    exemptPayeeCode: str(row.exempt_payee_code),
    fatcaCode: str(row.fatca_code),
    addressLine: str(row.address_line),
    city: str(row.city),
    state: str(row.state),
    zip: str(row.zip),
    tinType,
    tinLast4: row.tin_last4 ? str(row.tin_last4) : null,
    hasTin: Boolean(row.tin_enc),
    certify: Boolean(row.certify),
    signatureName: str(row.signature_name),
    signedOn: toIsoDay(str(row.signed_on)) || "",
    status: (str(row.status) || "draft") as FormStatus,
    adminNote: str(row.admin_note),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    ...(revealTin ? { tinFull: str(row.tin_enc) } : {}),
  };
}

function mapBank(row: Record<string, unknown>): BankPublic {
  return {
    bankName: str(row.bank_name),
    accountType: row.account_type === "savings" ? "savings" : row.account_type === "checking" ? "checking" : "",
    holderName: str(row.holder_name),
    routingLast4: row.routing_last4 ? str(row.routing_last4) : null,
    accountLast4: row.account_last4 ? str(row.account_last4) : null,
    hasNumbers: Boolean(row.routing_enc && row.account_enc),
    status: (str(row.status) || "draft") as FormStatus,
  };
}

function mapTime(row: Record<string, unknown>): TimeRequest {
  return {
    id: Number(row.id),
    userId: str(row.user_id),
    userName: str(row.user_name || "Rep"),
    kind: (str(row.kind) || "vacation") as TimeKind,
    startOn: toIsoDay(str(row.start_on)) || "",
    endOn: toIsoDay(str(row.end_on)) || "",
    note: str(row.note),
    status: (str(row.status) || "pending") as RequestStatus,
    adminNote: str(row.admin_note),
    createdAt: String(row.created_at),
  };
}

export const getDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireDeskProfile(context.userId);
    const sql = await getSql();
    const profiles = await sql.query<Parameters<typeof mapDeskProfile>[0]>(
      `select user_id, display_name, email, legal_name, phone, city, bio, emergency_name,
              emergency_phone, work_hours, monthly_goal, marker_color, ic_signed_at, pay_plan_signed_at,
              onboarded_at
       from profiles where user_id = $1`,
      [me.userId],
    );
    const w9 = await sql.query<Record<string, unknown>>(
      `select * from w9_forms where user_id = $1`,
      [me.userId],
    );
    const bank = await sql.query<Record<string, unknown>>(
      `select * from bank_accounts where user_id = $1`,
      [me.userId],
    );
    const time = await sql.query<Record<string, unknown>>(
      `select t.*, p.display_name as user_name
       from time_requests t join profiles p on p.user_id = t.user_id
       where t.user_id = $1
       order by t.start_on desc
       limit 40`,
      [me.userId],
    );
    const presenceRows = await sql.query<Record<string, unknown>>(
      `select status, note, until_on from desk_presence where user_id = $1`,
      [me.userId],
    );
    const threads = await sql.query<Record<string, unknown>>(
      `select t.*, p.display_name as user_name,
              (select body from desk_messages m where m.thread_id = t.id order by created_at desc limit 1) as preview
       from desk_threads t
       join profiles p on p.user_id = t.user_id
       where t.user_id = $1
       order by t.last_at desc
       limit 30`,
      [me.userId],
    );
    const unread = threads.reduce((n, t) => n + Number(t.salesman_unread || 0), 0);
    const presence: Presence = presenceRows[0]
      ? {
          status: presenceRows[0].status === "sick" || presenceRows[0].status === "off" ? presenceRows[0].status : "on",
          note: str(presenceRows[0].note),
          untilOn: presenceRows[0].until_on ? toIsoDay(str(presenceRows[0].until_on)) : null,
        }
      : { status: "on", note: "", untilOn: null };

    return {
      me,
      profile: mapDeskProfile(profiles[0]),
      w9: w9[0] ? mapW9(w9[0], false) : null,
      bank: bank[0] ? mapBank(bank[0]) : null,
      time: time.map(mapTime),
      presence,
      threads: threads.map((t) => ({
        id: Number(t.id),
        userId: str(t.user_id),
        userName: str(t.user_name),
        topic: (str(t.topic) || "other") as MsgTopic,
        subject: str(t.subject),
        status: t.status === "closed" ? "closed" : "open",
        lastAt: String(t.last_at),
        unread: Number(t.salesman_unread || 0),
        preview: str(t.preview),
      })) satisfies DeskThread[],
      unread,
    };
  });

export const saveDeskProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    displayName?: string;
    legalName?: string;
    phone?: string;
    city?: string;
    bio?: string;
    emergencyName?: string;
    emergencyPhone?: string;
    workHours?: string;
    monthlyGoal?: number;
  }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const sql = await getSql();
    const displayName = data.displayName?.trim() || me.displayName;
    const monthlyGoal =
      data.monthlyGoal != null && Number.isFinite(data.monthlyGoal)
        ? Math.max(1, Math.min(99, Math.round(data.monthlyGoal)))
        : undefined;
    await sql`
      update profiles
      set display_name = ${displayName},
          legal_name = ${data.legalName?.trim() ?? null},
          phone = ${data.phone?.trim() ?? null},
          city = ${data.city?.trim() ?? null},
          bio = ${data.bio?.trim() ?? null},
          emergency_name = ${data.emergencyName?.trim() ?? null},
          emergency_phone = ${data.emergencyPhone?.trim() ?? null},
          work_hours = ${data.workHours?.trim() ?? null},
          monthly_goal = coalesce(${monthlyGoal ?? null}, monthly_goal),
          updated_at = now()
      where user_id = ${me.userId}
    `;
    return { ok: true };
  });

export const signDeskDocs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { which: "ic" | "plan" }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const sql = await getSql();
    if (data.which === "ic") {
      await sql`update profiles set ic_signed_at = now(), updated_at = now() where user_id = ${me.userId}`;
    } else {
      await sql`update profiles set pay_plan_signed_at = now(), updated_at = now() where user_id = ${me.userId}`;
    }
    return { ok: true };
  });

export const saveW9 = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    legalName: string;
    businessName?: string;
    taxClass: TaxClass;
    llcTaxClass?: string;
    exemptPayeeCode?: string;
    fatcaCode?: string;
    addressLine: string;
    city: string;
    state: string;
    zip: string;
    tinType: "ssn" | "ein";
    tin?: string;
    certify: boolean;
    signatureName: string;
    submit?: boolean;
  }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const sql = await getSql();
    const existing = await sql.query<{ tin_enc: string | null; status: string }>(
      `select tin_enc, status from w9_forms where user_id = $1`,
      [me.userId],
    );
    if (existing[0]?.status === "approved" && data.submit) {
      throw new Error("This W-9 is already approved. Write admin if it must change.");
    }
    let tinEnc = existing[0]?.tin_enc ?? null;
    let tinLast4 = tinEnc ? tinEnc.slice(-4) : null;
    if (data.tin?.trim()) {
      const err = validateTin(data.tinType, data.tin);
      if (err) throw new Error(err);
      tinEnc = digitsOnly(data.tin);
      tinLast4 = tinEnc.slice(-4);
    }
    if (data.submit) {
      if (!data.legalName.trim()) throw new Error("Legal name is required");
      if (!data.addressLine.trim() || !data.city.trim() || !data.state.trim() || !data.zip.trim()) {
        throw new Error("Address, city, state, and ZIP are required");
      }
      if (!tinEnc) throw new Error("Enter your SSN or EIN");
      if (!data.certify) throw new Error("You must certify the W-9");
      if (!data.signatureName.trim()) throw new Error("Sign the form");
    }
    const status = data.submit ? "submitted" : "draft";
    const signedOn = data.submit ? todayIso() : null;
    await sql.query(
      `insert into w9_forms (
         user_id, legal_name, business_name, tax_class, llc_tax_class, exempt_payee_code, fatca_code,
         address_line, city, state, zip, tin_type, tin_last4, tin_enc, certify, signature_name,
         signed_on, status, submitted_at, updated_at
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
         case when $19 then now() else null end, now()
       )
       on conflict (user_id) do update set
         legal_name = excluded.legal_name,
         business_name = excluded.business_name,
         tax_class = excluded.tax_class,
         llc_tax_class = excluded.llc_tax_class,
         exempt_payee_code = excluded.exempt_payee_code,
         fatca_code = excluded.fatca_code,
         address_line = excluded.address_line,
         city = excluded.city,
         state = excluded.state,
         zip = excluded.zip,
         tin_type = excluded.tin_type,
         tin_last4 = coalesce(excluded.tin_last4, w9_forms.tin_last4),
         tin_enc = coalesce(excluded.tin_enc, w9_forms.tin_enc),
         certify = excluded.certify,
         signature_name = excluded.signature_name,
         signed_on = coalesce(excluded.signed_on, w9_forms.signed_on),
         status = excluded.status,
         submitted_at = case when $19 then now() else w9_forms.submitted_at end,
         admin_note = case when $19 then null else w9_forms.admin_note end,
         updated_at = now()`,
      [
        me.userId,
        data.legalName.trim(),
        data.businessName?.trim() || null,
        data.taxClass,
        data.llcTaxClass?.trim() || null,
        data.exemptPayeeCode?.trim() || null,
        data.fatcaCode?.trim() || null,
        data.addressLine.trim(),
        data.city.trim(),
        data.state.trim().toUpperCase(),
        data.zip.trim(),
        data.tinType,
        tinLast4,
        tinEnc,
        data.certify,
        data.signatureName.trim(),
        signedOn,
        status,
        Boolean(data.submit),
      ],
    );
    if (data.submit) {
      await sql`
        insert into floor_activity (actor_id, action, detail)
        values (${me.userId}, ${"submitted a W-9"}, ${me.displayName})
      `;
    }
    return { ok: true, status };
  });

export const saveBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: {
    bankName: string;
    accountType: "checking" | "savings";
    holderName: string;
    routing?: string;
    account?: string;
    submit?: boolean;
  }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const sql = await getSql();
    const existing = await sql.query<{ routing_enc: string | null; account_enc: string | null }>(
      `select routing_enc, account_enc from bank_accounts where user_id = $1`,
      [me.userId],
    );
    let routingEnc = existing[0]?.routing_enc ?? null;
    let accountEnc = existing[0]?.account_enc ?? null;
    if (data.routing?.trim()) {
      const err = validateRouting(data.routing);
      if (err) throw new Error(err);
      routingEnc = digitsOnly(data.routing);
    }
    if (data.account?.trim()) {
      const acc = digitsOnly(data.account);
      if (acc.length < 4 || acc.length > 17) throw new Error("Account number looks wrong");
      accountEnc = acc;
    }
    if (data.submit) {
      if (!data.bankName.trim() || !data.holderName.trim()) throw new Error("Bank and account holder are required");
      if (!routingEnc || !accountEnc) throw new Error("Enter routing and account numbers");
    }
    await sql.query(
      `insert into bank_accounts (
         user_id, bank_name, account_type, holder_name, routing_last4, account_last4,
         routing_enc, account_enc, status, updated_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       on conflict (user_id) do update set
         bank_name = excluded.bank_name,
         account_type = excluded.account_type,
         holder_name = excluded.holder_name,
         routing_last4 = coalesce(excluded.routing_last4, bank_accounts.routing_last4),
         account_last4 = coalesce(excluded.account_last4, bank_accounts.account_last4),
         routing_enc = coalesce(excluded.routing_enc, bank_accounts.routing_enc),
         account_enc = coalesce(excluded.account_enc, bank_accounts.account_enc),
         status = excluded.status,
         updated_at = now()`,
      [
        me.userId,
        data.bankName.trim(),
        data.accountType,
        data.holderName.trim(),
        routingEnc ? routingEnc.slice(-4) : null,
        accountEnc ? accountEnc.slice(-4) : null,
        routingEnc,
        accountEnc,
        data.submit ? "submitted" : "draft",
      ],
    );
    return { ok: true };
  });

export const requestTimeOff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { kind: TimeKind; startOn: string; endOn: string; note?: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startOn) || !/^\d{4}-\d{2}-\d{2}$/.test(data.endOn)) {
      throw new Error("Pick start and end dates");
    }
    if (data.endOn < data.startOn) throw new Error("End date is before start");
    const sql = await getSql();
    await sql`
      insert into time_requests (user_id, kind, start_on, end_on, note)
      values (${me.userId}, ${data.kind}, ${data.startOn}, ${data.endOn}, ${data.note?.trim() || null})
    `;
    if (data.kind !== "sick") {
      await sql`
        insert into floor_activity (actor_id, action, detail)
        values (${me.userId}, ${"requested time off"}, ${`${data.startOn} – ${data.endOn}`})
      `;
    }
    return { ok: true };
  });

export const cancelTimeRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: number }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const sql = await getSql();
    await sql`
      update time_requests
      set status = 'cancelled'
      where id = ${data.id} and user_id = ${me.userId} and status = 'pending'
    `;
    return { ok: true };
  });

export const callInSick = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { note?: string; untilOn?: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const today = todayIso();
    const until = data.untilOn && /^\d{4}-\d{2}-\d{2}$/.test(data.untilOn) ? data.untilOn : today;
    const sql = await getSql();
    await sql`
      insert into desk_presence (user_id, status, note, until_on, updated_at)
      values (${me.userId}, ${"sick"}, ${data.note?.trim() || null}, ${until}, now())
      on conflict (user_id) do update set
        status = ${"sick"},
        note = ${data.note?.trim() || null},
        until_on = ${until},
        updated_at = now()
    `;
    await sql`
      insert into time_requests (user_id, kind, start_on, end_on, note, status)
      values (${me.userId}, ${"sick"}, ${today}, ${until}, ${data.note?.trim() || null}, ${"approved"})
    `;
    await sql`
      insert into floor_activity (actor_id, action, detail)
      values (${me.userId}, ${"called in sick"}, ${until === today ? "today" : `through ${until}`})
    `;
    return { ok: true };
  });

export const setPresence = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { status: "on" | "off"; note?: string; untilOn?: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const sql = await getSql();
    const until = data.untilOn && /^\d{4}-\d{2}-\d{2}$/.test(data.untilOn) ? data.untilOn : null;
    await sql`
      insert into desk_presence (user_id, status, note, until_on, updated_at)
      values (${me.userId}, ${data.status}, ${data.note?.trim() || null}, ${until}, now())
      on conflict (user_id) do update set
        status = ${data.status},
        note = ${data.note?.trim() || null},
        until_on = ${until},
        updated_at = now()
    `;
    return { ok: true };
  });

export const startThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { topic: MsgTopic; subject: string; body: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const subject = data.subject.trim();
    const body = data.body.trim();
    if (!subject || !body) throw new Error("Subject and message are required");
    const sql = await getSql();
    const thread = await sql<{ id: number }>`
      insert into desk_threads (user_id, topic, subject, admin_unread)
      values (${me.userId}, ${data.topic}, ${subject}, 1)
      returning id
    `;
    await sql`
      insert into desk_messages (thread_id, author_id, body)
      values (${thread[0].id}, ${me.userId}, ${body})
    `;
    return { id: Number(thread[0].id) };
  });

export const finishOnboarding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireDeskProfile(context.userId);
    if (isFloorAdminEmail(me.email)) {
      const sql = await getSql();
      await sql`update profiles set onboarded_at = now(), updated_at = now() where user_id = ${me.userId}`;
      return { ok: true };
    }
    const sql = await getSql();
    const profiles = await sql.query<Parameters<typeof mapDeskProfile>[0]>(
      `select user_id, display_name, email, legal_name, phone, city, bio, emergency_name,
              emergency_phone, work_hours, monthly_goal, marker_color, ic_signed_at, pay_plan_signed_at,
              onboarded_at
       from profiles where user_id = $1`,
      [me.userId],
    );
    const w9Rows = await sql.query<Record<string, unknown>>(
      `select * from w9_forms where user_id = $1`,
      [me.userId],
    );
    const bankRows = await sql.query<Record<string, unknown>>(
      `select * from bank_accounts where user_id = $1`,
      [me.userId],
    );
    const profile = mapDeskProfile(profiles[0]);
    const w9 = w9Rows[0] ? mapW9(w9Rows[0], false) : null;
    const bank = bankRows[0] ? mapBank(bankRows[0]) : null;
    const missing = buildChecklist({ profile, w9, bank }).filter((c) => !c.done);
    if (missing.length) {
      throw new Error(`Still need: ${missing.map((c) => c.label).join(", ")}`);
    }

    const lines = [
      `1099 onboarding packet from ${profile.displayName}.`,
      "",
      `Legal name: ${profile.legalName}`,
      `Phone: ${profile.phone}`,
      `City: ${profile.city || "—"}`,
      `Emergency: ${profile.emergencyName || "—"} ${profile.emergencyPhone ? `· ${profile.emergencyPhone}` : ""}`.trim(),
      "",
      w9
        ? `W-9: ${w9.legalName} · ${TAX_CLASS[w9.taxClass]} · ${[w9.addressLine, w9.city, w9.state, w9.zip].filter(Boolean).join(", ")} · TIN ${maskTin(w9.tinType, w9.tinLast4)} · signed ${w9.signedOn || "today"}`
        : "W-9: missing",
      bank
        ? `Direct deposit: ${bank.bankName} ${bank.accountType} · ••••${bank.accountLast4 ?? "????"} · ${bank.holderName}`
        : "Direct deposit: missing",
      "IC agreement: signed",
      "Pay plan: signed",
      "",
      "Review W-9 TIN and deposit numbers in Desk ops. Reply on this thread if anything is off.",
    ];

    const existing = await sql<{ id: number }>`
      select id from desk_threads
      where user_id = ${me.userId} and topic = ${"tax"} and subject like ${"1099 onboarding%"}
      order by last_at desc
      limit 1
    `;
    let threadId = existing[0]?.id;
    if (!threadId) {
      const created = await sql<{ id: number }>`
        insert into desk_threads (user_id, topic, subject, admin_unread)
        values (${me.userId}, ${"tax"}, ${`1099 onboarding — ${profile.displayName}`}, 1)
        returning id
      `;
      threadId = created[0].id;
    } else {
      await sql`
        update desk_threads
        set last_at = now(), admin_unread = admin_unread + 1, status = 'open'
        where id = ${threadId}
      `;
    }
    await sql`
      insert into desk_messages (thread_id, author_id, body)
      values (${threadId}, ${me.userId}, ${lines.join("\n")})
    `;
    await sql`
      update profiles set onboarded_at = now(), updated_at = now() where user_id = ${me.userId}
    `;
    await sql`
      insert into floor_activity (actor_id, action, detail)
      values (${me.userId}, ${"sent 1099 packet"}, ${profile.displayName})
    `;
    return { ok: true };
  });

export const replyThread = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { threadId: number; body: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const body = data.body.trim();
    if (!body) throw new Error("Message is empty");
    const sql = await getSql();
    const thread = await sql.query<{ user_id: string; status: string }>(
      `select user_id, status from desk_threads where id = $1`,
      [data.threadId],
    );
    if (!thread[0]) throw new Error("Thread not found");
    const admin = me.role === "admin" && isFloorAdminEmail(me.email);
    if (thread[0].user_id !== me.userId && !admin) throw new Error("Not your thread");
    await sql`
      insert into desk_messages (thread_id, author_id, body)
      values (${data.threadId}, ${me.userId}, ${body})
    `;
    if (admin) {
      await sql`
        update desk_threads
        set last_at = now(), salesman_unread = salesman_unread + 1, status = 'open'
        where id = ${data.threadId}
      `;
    } else {
      await sql`
        update desk_threads
        set last_at = now(), admin_unread = admin_unread + 1, status = 'open'
        where id = ${data.threadId}
      `;
    }
    return { ok: true };
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { threadId: number }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskProfile(context.userId);
    const sql = await getSql();
    const thread = await sql.query<Record<string, unknown>>(
      `select t.*, p.display_name as user_name
       from desk_threads t join profiles p on p.user_id = t.user_id
       where t.id = $1`,
      [data.threadId],
    );
    if (!thread[0]) throw new Error("Thread not found");
    const admin = me.role === "admin" && isFloorAdminEmail(me.email);
    if (str(thread[0].user_id) !== me.userId && !admin) throw new Error("Not your thread");
    const msgs = await sql.query<Record<string, unknown>>(
      `select m.*, p.display_name as author_name
       from desk_messages m join profiles p on p.user_id = m.author_id
       where m.thread_id = $1
       order by m.created_at asc`,
      [data.threadId],
    );
    if (admin) {
      await sql`update desk_threads set admin_unread = 0 where id = ${data.threadId}`;
    } else {
      await sql`update desk_threads set salesman_unread = 0 where id = ${data.threadId}`;
    }
    return {
      thread: {
        id: Number(thread[0].id),
        userId: str(thread[0].user_id),
        userName: str(thread[0].user_name),
        topic: (str(thread[0].topic) || "other") as MsgTopic,
        subject: str(thread[0].subject),
        status: thread[0].status === "closed" ? "closed" : "open",
        lastAt: String(thread[0].last_at),
        unread: 0,
        preview: "",
      } satisfies DeskThread,
      messages: msgs.map((m) => ({
        id: Number(m.id),
        threadId: Number(m.thread_id),
        authorId: str(m.author_id),
        authorName: str(m.author_name),
        mine: str(m.author_id) === me.userId,
        body: str(m.body),
        createdAt: String(m.created_at),
      })) satisfies DeskMessage[],
    };
  });

export const getDeskOps = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireDeskAdmin(context.userId);
    const sql = await getSql();
    const today = todayIso();
    const w9s = await sql.query<Record<string, unknown>>(
      `select w.*, p.display_name as user_name, p.email
       from w9_forms w join profiles p on p.user_id = w.user_id
       order by case w.status when 'submitted' then 0 when 'returned' then 1 when 'approved' then 2 else 3 end,
                w.updated_at desc`,
    );
    const banks = await sql.query<Record<string, unknown>>(
      `select b.*, p.display_name as user_name
       from bank_accounts b join profiles p on p.user_id = b.user_id
       order by case b.status when 'submitted' then 0 else 1 end, b.updated_at desc`,
    );
    const time = await sql.query<Record<string, unknown>>(
      `select t.*, p.display_name as user_name
       from time_requests t join profiles p on p.user_id = t.user_id
       where t.status <> 'cancelled'
       order by case t.status when 'pending' then 0 else 1 end, t.start_on desc
       limit 80`,
    );
    const sick = await sql.query<Record<string, unknown>>(
      `select pr.user_id, p.display_name as user_name, pr.status, pr.note, pr.until_on
       from desk_presence pr join profiles p on p.user_id = pr.user_id
       where pr.status in ('sick','off') and (pr.until_on is null or pr.until_on >= $1)`,
      [today],
    );
    const threads = await sql.query<Record<string, unknown>>(
      `select t.*, p.display_name as user_name,
              (select body from desk_messages m where m.thread_id = t.id order by created_at desc limit 1) as preview
       from desk_threads t join profiles p on p.user_id = t.user_id
       order by t.admin_unread desc, t.last_at desc
       limit 50`,
    );
    return {
      w9s: w9s.map((r) => ({
        userId: str(r.user_id),
        userName: str(r.user_name),
        email: str(r.email),
        form: mapW9(r, true),
      })),
      banks: banks.map((r) => ({
        userId: str(r.user_id),
        userName: str(r.user_name),
        bank: mapBank(r),
        routing: str(r.routing_enc),
        account: str(r.account_enc),
      })),
      time: time.map(mapTime),
      out: sick.map((r) => ({
        userId: str(r.user_id),
        userName: str(r.user_name),
        status: str(r.status),
        note: str(r.note),
        untilOn: r.until_on ? toIsoDay(str(r.until_on)) : null,
      })),
      threads: threads.map((t) => ({
        id: Number(t.id),
        userId: str(t.user_id),
        userName: str(t.user_name),
        topic: (str(t.topic) || "other") as MsgTopic,
        subject: str(t.subject),
        status: t.status === "closed" ? "closed" : "open",
        lastAt: String(t.last_at),
        unread: Number(t.admin_unread || 0),
        preview: str(t.preview),
      })) satisfies DeskThread[],
    };
  });

export const reviewW9 = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { userId: string; status: "approved" | "returned"; adminNote?: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskAdmin(context.userId);
    const sql = await getSql();
    await sql`
      update w9_forms
      set status = ${data.status},
          admin_note = ${data.adminNote?.trim() || null},
          reviewed_at = now(),
          reviewed_by = ${me.userId},
          updated_at = now()
      where user_id = ${data.userId}
    `;
    return { ok: true };
  });

export const reviewBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { userId: string; status: "approved" | "returned" }) => data)
  .handler(async ({ context, data }) => {
    await requireDeskAdmin(context.userId);
    const sql = await getSql();
    await sql`
      update bank_accounts set status = ${data.status}, updated_at = now() where user_id = ${data.userId}
    `;
    return { ok: true };
  });

export const reviewTime = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: number; status: "approved" | "denied"; adminNote?: string }) => data)
  .handler(async ({ context, data }) => {
    const me = await requireDeskAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<{ user_id: string; kind: string; start_on: string; end_on: string }>(
      `select user_id, kind, start_on, end_on from time_requests where id = $1`,
      [data.id],
    );
    if (!rows[0]) throw new Error("Request not found");
    await sql`
      update time_requests
      set status = ${data.status},
          admin_note = ${data.adminNote?.trim() || null},
          reviewed_at = now(),
          reviewed_by = ${me.userId}
      where id = ${data.id}
    `;
    if (data.status === "approved" && rows[0].kind !== "sick") {
      await sql`
        insert into desk_presence (user_id, status, note, until_on, updated_at)
        values (${rows[0].user_id}, ${"off"}, ${"Approved time off"}, ${rows[0].end_on}, now())
        on conflict (user_id) do update set
          status = ${"off"},
          until_on = ${rows[0].end_on},
          updated_at = now()
      `;
    }
    return { ok: true };
  });
