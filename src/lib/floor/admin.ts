export const FLOOR_ADMIN_EMAIL = "teamconnect@supercleads.com";

export function isFloorAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === FLOOR_ADMIN_EMAIL;
}
