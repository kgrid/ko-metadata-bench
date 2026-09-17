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
    await expect(page.getByRole("button", { name: "Knowledge Objects", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
}
