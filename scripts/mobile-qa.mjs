import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const errors = [];
page.on("pageerror", (err) => errors.push(String(err.message || err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const email = `mob.${Date.now()}@supercleads.com`;
await page.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle", timeout: 45000 });
await page.screenshot({ path: "/workspace/screenshots/mobile-login.png" });
await page.getByRole("button", { name: /create an account/i }).click();
await page.getByPlaceholder("Jaydan").fill("Closer One");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill("FloorBoard4995");
await page.getByRole("button", { name: /create floor account/i }).click();
await page.getByRole("heading", { name: /the x board/i }).waitFor({ timeout: 25000 });
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/mobile-board.png" });

await page.getByRole("button", { name: /post an x/i }).first().click();
await page.waitForTimeout(400);
const dialogBox = page.locator("[role=dialog]");
await dialogBox.waitFor({ timeout: 8000 });
const dialogGeom = await dialogBox.boundingBox();
await page.screenshot({ path: "/workspace/screenshots/mobile-dialog.png" });
await page.getByRole("button", { name: /close/i }).first().click();

await page.getByRole("navigation").getByRole("link", { name: "CRM" }).click();
await page.getByRole("heading", { name: /pipeline/i }).waitFor({ timeout: 15000 });
await page.getByRole("button", { name: /new record/i }).click();
await page.locator("input[required]").first().fill("Riverside HVAC");
await page.getByPlaceholder("HVAC, roofing…").fill("HVAC");
await page.getByRole("button", { name: /^save$/i }).click();
await page.getByRole("heading", { name: /riverside hvac/i }).waitFor({ timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/mobile-record.png" });
await page.getByRole("main").getByRole("link", { name: /^crm$/i }).click();
await page.getByRole("heading", { name: /pipeline/i }).waitFor({ timeout: 10000 });
await page.screenshot({ path: "/workspace/screenshots/mobile-crm.png" });

await page.getByRole("navigation").getByRole("link", { name: "Pay" }).click();
await page.getByRole("heading", { name: /^pay$/i }).waitFor({ timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/mobile-pay.png" });

await page.getByRole("navigation").getByRole("link", { name: "My Day" }).click();
await page.getByRole("heading", { name: /my day/i }).waitFor({ timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/mobile-day.png" });

const pages = ["/", "/crm", "/pay", "/dashboard"];
const overflows = {};
for (const path of pages) {
  await page.goto(`http://127.0.0.1:8080${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  overflows[path] = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
}

const sheet = dialogGeom
  ? {
      nearBottom: dialogGeom.y + dialogGeom.height > 700,
      fullWidth: dialogGeom.width >= 380,
    }
  : null;

console.log(JSON.stringify({ errors, overflows, sheet, dialogGeom }, null, 2));
await browser.close();
if (errors.length) process.exit(2);
if (Object.values(overflows).some(Boolean)) process.exit(4);
if (sheet && !sheet.fullWidth) process.exit(5);
