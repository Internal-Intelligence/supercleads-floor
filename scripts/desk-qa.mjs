import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err.message || err)));

const email = `desk.${Date.now()}@supercleads.com`;
await page.goto("http://127.0.0.1:8080/login", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.getByRole("button", { name: /create an account/i }).click();
await page.getByPlaceholder("Jaydan").fill("Desk Rep");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill("FloorBoard4995");
await page.getByRole("button", { name: /create floor account/i }).click();
await page.getByRole("heading", { name: /the board/i }).waitFor({ timeout: 25000 });

await page.goto("http://127.0.0.1:8080/desk", { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: /your desk/i }).waitFor({ timeout: 20000 });
const ready = await page.getByText(/to get paid|ready to sell/i).first().isVisible();
await page.screenshot({ path: "/workspace/screenshots/desk-home.png", fullPage: true });

await page.getByRole("button", { name: /^w-9/i }).click();
await page.getByText(/form w-9/i).waitFor({ timeout: 8000 });
await page.screenshot({ path: "/workspace/screenshots/desk-w9.png", fullPage: true });

await page.getByRole("button", { name: /^time$/i }).click();
await page.getByRole("button", { name: /call in sick/i }).waitFor({ timeout: 8000 });
await page.screenshot({ path: "/workspace/screenshots/desk-time.png" });

console.log(JSON.stringify({ errors, ready, url: page.url() }, null, 2));
await browser.close();
if (errors.length) process.exit(2);
if (!ready) process.exit(3);
