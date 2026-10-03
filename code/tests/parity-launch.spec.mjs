import { expect, test } from "@playwright/test";

const editions = [
  { name: "server-deployed", url: "http://127.0.0.1:3100/" },
  {
    name: "standalone",
    url: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
  },
];

for (const edition of editions) {
  test(`${edition.name} edition launches with four embedded knowledge objects`, async ({ page }) => {
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle("FAIR Knowledge Object Bench");
    await expect(page.getByRole("heading", { name: "Knowledge Objects", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open .+ overview$/ })).toHaveCount(4);
    await expect(page.getByText("HBOT Treatment Target Knowledge Assembly", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Knowledge Objects", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    await expect(page.getByText("HBOT Treatment Target Knowledge Assembly", { exact: true })).toBeVisible();
    const loadButton = page.getByRole("button", { name: "Load as Knowledge Object", exact: true });
    await expect(loadButton).toBeVisible();
    await expect(loadButton).toBeEnabled();
    await loadButton.click();
    await expect(page.getByRole("status")).toHaveText("Loaded as a Knowledge Object");
    await expect(page.getByRole("button", { name: "Load as Knowledge Object", exact: true })).toHaveCount(0);
    await expect(page.getByText("HBOT Treatment Target Knowledge Assembly", { exact: true })).toBeVisible();
    const generalViews = [
      "Knowledge Objects",
      "Metadata Rig",
      "F exercise",
      "A exercise",
      "I exercise",
      "R exercise",
    ];
    for (const control of generalViews) {
      await page.getByRole("button", { name: control, exact: true }).click();
      await expect(page.getByText("HBOT Treatment Target Knowledge Assembly", { exact: true }).first()).toBeVisible();
    }
    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    await page.getByRole("button", { name: "Orchestration", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Orchestration" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Case 1", exact: true })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Knowledge Objects", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open .+ overview$/ })).toHaveCount(4);
    await expect(page.getByText("HBOT Treatment Target Knowledge Assembly", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    await expect(page.getByRole("button", { name: "Load as Knowledge Object", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Orchestration", exact: true })).toBeEnabled();
  });
}
