import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (err) => errors.push("page:" + String(err.message || err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("console:" + msg.text());
});

const email = `crm.${Date.now()}@supercleads.com`;
await page.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle", timeout: 45000 });
await page.getByRole("button", { name: /create an account/i }).click();
await page.getByPlaceholder("Jaydan").fill("Closer One");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill("FloorBoard4995");
await Promise.all([
  page.waitForURL((url) => url.pathname === "/", { timeout: 25000 }),
  page.getByRole("button", { name: /create floor account/i }).click(),
]);
await page.getByRole("heading", { name: /the x board/i }).waitFor({ timeout: 25000 });

await page.getByRole("navigation").getByRole("link", { name: "CRM" }).click();
await page.getByRole("heading", { name: /pipeline/i }).waitFor({ timeout: 15000 });

async function addRecord(name, company) {
  await page.getByRole("button", { name: /new record/i }).click();
  await page.locator("#name, input[required]").first().fill(name);
  const companyInput = page.getByPlaceholder("HVAC, roofing…");
  await companyInput.fill(company);
  await page.getByRole("button", { name: /^save$/i }).click();
  await page.getByRole("heading", { name: name }).waitFor({ timeout: 15000 });
  await page.getByRole("main").getByRole("link", { name: /^crm$/i }).click();
  await page.getByRole("heading", { name: /pipeline/i }).waitFor({ timeout: 10000 });
}

await addRecord("Riverside HVAC", "HVAC");
await addRecord("Oak Ridge Roofing", "Roofing");
await page.screenshot({ path: "/workspace/screenshots/crm-pipeline.png" });

await page.getByRole("button", { name: /riverside hvac/i }).first().click();
await page.getByRole("heading", { name: /riverside hvac/i }).waitFor({ timeout: 15000 });
await page.getByPlaceholder("Add a note to this record").fill("Shared leads, bleeding $4,200/mo.");
await page.getByRole("button", { name: /add note/i }).click();
await page.waitForTimeout(400);
await page.locator('input[name="monthlySpend"]').fill("4200");
await page.locator('input[name="currentProvider"]').fill("Shared / rented leads");
await page.locator('input[name="painNotes"]').fill("We keep getting multi-sold");
await page.getByRole("button", { name: /save record/i }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/crm-record.png" });

await page.getByRole("button", { name: /close ownership/i }).click();
await page.getByPlaceholder("Name or company").fill("Riverside HVAC");
await page.locator("label").filter({ hasText: /intelligence attach/i }).click();
await page.locator("label").filter({ hasText: /pain killer/i }).click();
await page.getByRole("button", { name: /mark the x/i }).click();
await page.waitForTimeout(800);

const recText = await page.locator("main").innerText();
await page.screenshot({ path: "/workspace/screenshots/crm-closed.png" });

await page.getByRole("navigation").getByRole("link", { name: "Board" }).click();
await page.getByRole("heading", { name: /the x board/i }).waitFor({ timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/crm-board.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle" });
await mobile.locator('input[type="email"]').fill(email);
await mobile.locator('input[type="password"]').fill("FloorBoard4995");
await mobile.getByRole("button", { name: /^sign in$/i }).click();
await mobile.getByRole("heading", { name: /the x board/i }).waitFor({ timeout: 20000 });
await mobile.getByRole("navigation").getByRole("link", { name: "CRM" }).click();
await mobile.getByRole("heading", { name: /pipeline/i }).waitFor({ timeout: 15000 });
await mobile.screenshot({ path: "/workspace/screenshots/mobile-crm.png" });
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
);

console.log(JSON.stringify({
  errors,
  overflow,
  recHasNote: /shared leads/i.test(recText),
  recHasClose: /closed/i.test(recText),
  recText: recText.slice(0, 700),
}, null, 2));

await browser.close();
if (errors.length) process.exit(2);
if (overflow) process.exit(4);
