import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("fixture plan moves through review, local approval, record and export", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("FIXTURE MODE")).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Plan/ }).click();
  await page.getByLabel("NVDAB target (%)").fill("80");
  await page.getByLabel("AMDB target (%)").fill("20");
  await page.getByRole("button", { name: "Generate fixture preview" }).click();
  await expect(page.getByText("Reduced by fixture per-leg cap")).toBeVisible();
  await expect(page.getByText("$16.00", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Approve fixture plan" }).click();
  await expect(page.getByText("Fixture approved")).toBeVisible();
  await page.getByRole("button", { name: "Record sample outcome" }).click();
  await expect(page.getByText("RECONCILED FIXTURE")).toBeVisible();
  await expect(page.getByText("Chain transaction", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download fixture JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("nexus-fixture-record.json");
  const payload = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(payload.schema).toBe("nexus.fixture.v1");
  expect(payload.fixtureReceipts).toHaveLength(1);
  expect(payload.notice).toContain("No wallet approval");
  await page.reload();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Review/ }).click();
  await expect(page.getByText("No preview yet")).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Activity/ }).click();
  await expect(page.getByText("RECONCILED FIXTURE")).toBeVisible();
});

test("invalid input and pause block the local approval", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Plan/ }).click();
  await page.getByLabel("AMDB target (%)").fill("30");
  await page.getByRole("button", { name: "Generate fixture preview" }).click();
  await expect(page.locator(".error-banner")).toContainText("Target weights must add to 100%");
  await page.getByLabel("AMDB target (%)").fill("40");
  await page.getByRole("button", { name: "Generate fixture preview" }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Settings/ }).click();
  await page.getByRole("button", { name: "Pause fixture" }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Review/ }).click();
  await expect(page.getByRole("button", { name: "Approve fixture plan" })).toBeDisabled();
  await expect(page.getByText("Local fixture is paused")).toBeVisible();
});

test("keyboard navigation and read-only wallet discovery work at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, "ethereum", { value: {
      request: async ({ method }: { method: string }) => {
        if (method === "eth_accounts") return ["0x1111111111111111111111111111111111111111"];
        if (method === "eth_chainId") return "0x38";
        throw new Error("Unexpected wallet method");
      },
    } });
  });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Overview/ })).toBeFocused();
  await page.getByRole("button", { name: "Check connected wallet" }).click();
  await expect(page.getByText(/0x1111…1111 · BNB Smart Chain/)).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Plan/ }).click();
  await expect(page.getByRole("button", { name: "Generate fixture preview" })).toBeVisible();
});
