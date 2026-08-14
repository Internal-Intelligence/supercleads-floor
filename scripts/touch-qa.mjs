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

const email = `touch.${Date.now()}@supercleads.com`;
await page.goto("http://127.0.0.1:8080/login", { waitUntil: "domcontentloaded", timeout: 45000 });
await page.getByRole("button", { name: /create an account/i }).click();
await page.getByPlaceholder("Jaydan").fill("Touch Rep");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill("FloorBoard4995");
await page.getByRole("button", { name: /create floor account/i }).click();
await page.getByRole("heading", { name: /the board/i }).waitFor({ timeout: 25000 });
const hint = await page.getByText(/on your phone/i).isVisible();
const swipe = await page.getByText(/swipe/i).first().isVisible();
await page.screenshot({ path: "/workspace/screenshots/mobile-gestures.png" });

await page.getByRole("button", { name: /draw an x/i }).first().tap();
await page.locator("canvas.marker-pad, canvas").first().waitFor({ timeout: 8000 });
const canvas = page.locator("canvas").first();
const box = await canvas.boundingBox();
if (!box) throw new Error("no pad");

async function stroke(x1, y1, x2, y2) {
  await page.touchscreen.tap(x1, y1);
  await page.evaluate(
    async ([a, b]) => {
      const el = document.querySelector("canvas");
      if (!el) return;
      const down = new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: "touch",
        clientX: a[0],
        clientY: a[1],
      });
      el.dispatchEvent(down);
      const steps = 10;
      for (let i = 1; i <= steps; i += 1) {
        const x = a[0] + ((b[0] - a[0]) * i) / steps;
        const y = a[1] + ((b[1] - a[1]) * i) / steps;
        el.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType: "touch",
            clientX: x,
            clientY: y,
          }),
        );
      }
      el.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: 7,
          pointerType: "touch",
          clientX: b[0],
          clientY: b[1],
        }),
      );
    },
    [
      [x1, y1],
      [x2, y2],
    ],
  );
}

await stroke(box.x + 36, box.y + 36, box.x + box.width - 36, box.y + box.height - 36);
await stroke(box.x + box.width - 36, box.y + 36, box.x + 36, box.y + box.height - 36);
await page.waitForTimeout(200);
const hang = page.getByRole("button", { name: /hang the x/i });
const hangDisabled = await hang.isDisabled();
await page.screenshot({ path: "/workspace/screenshots/mobile-draw-pad.png" });

if (!hangDisabled) {
  await hang.tap();
  await page.getByText(/x on the board/i).waitFor({ timeout: 15000 });
}
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/mobile-drawn-board.png" });

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
);

console.log(JSON.stringify({ errors, hint, swipe, hangDisabled, overflow }, null, 2));
await browser.close();
if (errors.length) process.exit(2);
if (!hint) process.exit(3);
if (hangDisabled) process.exit(4);
if (overflow) process.exit(5);
