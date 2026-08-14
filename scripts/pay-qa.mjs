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

const email = `pay.${Date.now()}@supercleads.com`;
const password = "FloorBoard4995";

await page.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle", timeout: 45000 });
await page.getByRole("button", { name: /create an account/i }).click();
await page.getByPlaceholder("Jaydan").fill("Closer One");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await Promise.all([
  page.waitForURL((url) => url.pathname === "/", { timeout: 25000 }),
  page.getByRole("button", { name: /create floor account/i }).click(),
]);
await page.getByRole("heading", { name: /the x board/i }).waitFor({ timeout: 25000 });

async function postX(name, { intel = false, pain = false } = {}) {
  await page.getByRole("button", { name: /post an x/i }).first().click();
  await page.getByPlaceholder("Name or company").fill(name);
  await page.locator('input[type="date"]').first().fill("2026-08-02");
  if (intel) await page.locator("label").filter({ hasText: /intelligence attach/i }).click();
  if (pain) await page.locator("label").filter({ hasText: /pain killer/i }).click();
  await page.getByRole("button", { name: /mark the x/i }).click();
  await page.waitForTimeout(700);
}

await postX("Riverside HVAC", { intel: true, pain: true });
await page.getByRole("navigation").getByRole("link", { name: "Pay" }).click();
await page.getByRole("heading", { name: /^pay$/i }).waitFor({ timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: "/workspace/screenshots/pay.png" });
const payText = await page.locator("main").innerText();

await page.getByRole("navigation").getByRole("link", { name: "My Day" }).click();
await page.getByRole("heading", { name: /my day/i }).waitFor({ timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/dashboard-pay.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle" });
await mobile.locator('input[type="email"]').fill(email);
await mobile.locator('input[type="password"]').fill(password);
await mobile.getByRole("button", { name: /^sign in$/i }).click();
await mobile.getByRole("heading", { name: /the x board/i }).waitFor({ timeout: 20000 });
await mobile.getByRole("navigation").getByRole("link", { name: "Pay" }).click();
await mobile.getByRole("heading", { name: /^pay$/i }).waitFor({ timeout: 15000 });
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: "/workspace/screenshots/mobile-pay.png" });
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
);

console.log(JSON.stringify({ errors, overflow, email, payText: payText.slice(0, 800) }, null, 2));
await browser.close();
if (errors.length) process.exit(2);
if (!/\$1,774\.50|\$1774\.50|1,774/.test(payText) && !/\$1,000/.test(payText)) {
  console.error("expected Fast Start / stacked pay on statement");
  process.exit(3);
}
