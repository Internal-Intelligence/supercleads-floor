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

const email = `desk.${Date.now()}@supercleads.com`;
const password = "FloorBoard4995";

await page.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle", timeout: 45000 });
await page.getByRole("button", { name: /create an account/i }).click();
await page.getByPlaceholder("Jaydan").fill("Jaydan Eaton");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await Promise.all([
  page.waitForURL((url) => url.pathname === "/", { timeout: 25000 }),
  page.getByRole("button", { name: /create floor account/i }).click(),
]);
await page.getByRole("heading", { name: /the x board/i }).waitFor({ timeout: 25000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/board-empty.png" });

const post = page.getByRole("button", { name: /post an x/i }).first();
await post.click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/board-dialog.png" });

const mark = page.getByRole("button", { name: /mark the x/i });
if (await mark.count() === 0) {
  const html = await page.locator("body").innerText();
  console.log("NO MARK BUTTON\n", html.slice(0, 2000));
  console.log("errors", errors);
  await browser.close();
  process.exit(1);
}

await page.getByPlaceholder("Name or company").fill("Riverside HVAC");
await mark.click();
await page.getByText(/x on the board/i).waitFor({ timeout: 15000 }).catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: "/workspace/screenshots/board-x.png" });

await page.getByRole("link", { name: "My Day" }).click();
await page.getByRole("heading", { name: /my day/i }).waitFor({ timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/dashboard.png" });

await page.getByRole("navigation").getByRole("link", { name: "Follow-ups" }).click();
await page.getByRole("heading", { name: /follow-ups/i }).waitFor({ timeout: 15000 });
await page.getByRole("button", { name: "Add customer" }).click();
await page.waitForTimeout(300);
await page.locator('[role="dialog"] input').first().fill("Marcus Cole");
await page.getByPlaceholder("HVAC, roofing…").fill("Cole Electric");
await page.getByRole("button", { name: "Save" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: "/workspace/screenshots/followups.png" });

await page.getByRole("link", { name: "Admin" }).click();
await page.getByRole("heading", { name: /floor control/i }).waitFor({ timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/admin.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle" });
await mobile.locator('input[type="email"]').fill(email);
await mobile.locator('input[type="password"]').fill(password);
await mobile.getByRole("button", { name: /^sign in$/i }).click();
await mobile.getByRole("heading", { name: /the x board/i }).waitFor({ timeout: 20000 });
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: "/workspace/screenshots/mobile-board.png" });
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
);

console.log(JSON.stringify({ errors, overflow, email }, null, 2));
await browser.close();
if (errors.length) process.exit(2);
