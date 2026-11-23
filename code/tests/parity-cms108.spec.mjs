import { expect, test } from "@playwright/test";

for (const [edition, url] of [
  ["server", "http://127.0.0.1:3100/"],
  ["standalone", new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href],
]) {
  test(`${edition} exposes the CMS108 files and core metadata without a KA or Runner`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => Boolean(window.FDOBench?.access));
    await expect(page.getByRole("heading", { name: "Knowledge Objects", exact: true })).toBeVisible();
    await expect(page.getByText("Instrument set: 1 embedded knowledge object", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Knowledge Assembly", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /CMS108.* Runner unavailable/ })).toBeDisabled();
    await page.getByRole("button", { name: /^Open CMS108.* files$/ }).click();

    const picker = page.getByLabel("Browse files");
    await expect(picker.locator("option")).toHaveCount(1232);
    await picker.selectOption("specs/CMS108FHIR-v1.0.000-FHIR.html");
    await expect(page.locator(".koReader code, .ko-reader code").last()).toContainText("<!DOCTYPE html>");
    await picker.selectOption("src/cli/run_cms108.js");
    await expect(page.locator(".koReader code, .ko-reader code").last()).toContainText("fqm-execution");
    await page.getByRole("button", { name: "Close knowledge object files" }).click();
    await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
    await expect(page.getByRole("button", { name: "Interact", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "K exercise", exact: true }).click();
    await page.getByRole("button", { name: /^Explore CMS108/ }).click();
    await expect(page.getByRole("group", { name: "Knowledge element: CMS108FHIR VTE Prophylaxis measure logic" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}
