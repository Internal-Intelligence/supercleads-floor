import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err.message || err)));

const email = `board.${Date.now()}@supercleads.com`;
await page.goto("http://127.0.0.1:8080/login", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.getByRole("button", { name: /create an account/i }).click();
await page.getByPlaceholder("Jaydan").fill("Jaydan Eaton");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill("FloorBoard4995");
await page.getByRole("button", { name: /create floor account/i }).click();
await page.getByRole("heading", { name: /the board/i }).waitFor({ timeout: 25000 });
await page.screenshot({ path: "/workspace/screenshots/whiteboard-empty.png" });

await page.getByRole("button", { name: /draw an x/i }).first().click();
await page.getByRole("heading", { name: /draw an x/i }).waitFor({ timeout: 10000 });
await page.getByRole("button", { name: /^red$/i }).click();
const canvas = page.locator("canvas");
await canvas.waitFor({ timeout: 8000 });
const box = await canvas.boundingBox();
if (!box) throw new Error("no canvas");
await page.mouse.move(box.x + 40, box.y + 40);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 40, box.y + box.height - 40, { steps: 12 });
await page.mouse.up();
await page.mouse.move(box.x + box.width - 40, box.y + 40);
await page.mouse.down();
await page.mouse.move(box.x + 40, box.y + box.height - 40, { steps: 12 });
await page.mouse.up();
await page.getByPlaceholder("Name or company").fill("Riverside HVAC");
await page.getByRole("button", { name: /hang the x/i }).click();
await page.getByText(/x on the board/i).waitFor({ timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: "/workspace/screenshots/whiteboard-drawn.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mobile.goto("http://127.0.0.1:8080/login", { waitUntil: "domcontentloaded" });
await mobile.locator('input[type="email"]').fill(email);
await mobile.locator('input[type="password"]').fill("FloorBoard4995");
await mobile.getByRole("button", { name: /^sign in$/i }).click();
await mobile.getByRole("heading", { name: /the board/i }).waitFor({ timeout: 20000 });
await mobile.screenshot({ path: "/workspace/screenshots/mobile-whiteboard.png" });
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
);

const text = await page.locator("body").innerText();
console.log(JSON.stringify({
  errors,
  overflow,
  hasTitle: /sales achievements/i.test(text),
  hasHunger: /hunt line|stay hungry|don't be beat/i.test(text),
}, null, 2));

await browser.close();
if (errors.length) process.exit(2);
if (!/sales achievements/i.test(text)) process.exit(3);
if (overflow) process.exit(4);
