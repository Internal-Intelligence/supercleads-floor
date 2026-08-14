import { getSql } from "@/lib/db";
import { isFloorAdminEmail } from "./admin";
import type { FloorRole, Profile } from "./types";
import { DEFAULT_MARKER } from "./markers";

async function loadProfile(userId: string): Promise<Profile | null> {
  const sql = await getSql();
  const rows = await sql<{
    user_id: string;
    display_name: string;
    email: string | null;
    role: string;
    initials: string;
    monthly_goal: number;
    active: boolean;
    marker_color: string | null;
  }>`
    select user_id, display_name, email, role, initials, monthly_goal, active, marker_color
    from profiles where user_id = ${userId} limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const role: FloorRole = isFloorAdminEmail(row.email) ? "admin" : "salesman";
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    role,
    initials: row.initials,
    monthlyGoal: Number(row.monthly_goal) || 10,
    active: Boolean(row.active),
    markerColor: row.marker_color || DEFAULT_MARKER,
  };
}

export async function requireDeskProfile(userId: string) {
  const profile = await loadProfile(userId);
  if (!profile) throw new Error("Sign in to open your desk");
  if (!profile.active) throw new Error("Your floor access is paused");
  return profile;
}

export async function requireDeskAdmin(userId: string) {
  const profile = await requireDeskProfile(userId);
  if (profile.role !== "admin" || !isFloorAdminEmail(profile.email)) {
    throw new Error("Admin only");
  }
  return profile;
}

export async function getProfileForDesk(userId: string) {
  return loadProfile(userId);
}
