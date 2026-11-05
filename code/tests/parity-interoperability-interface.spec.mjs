import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};

for (const [edition, url] of Object.entries(editions)) {
  test(`${edition} Interface stage activation leaves the page responsive`, async ({ browser }) => {
    test.setTimeout(15000);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "I exercise", exact: true }).click();
    await page.getByRole("button", { name: "Stages", exact: true }).first().click();
    const selector = edition === "server"
      ? '.interoperabilityStagesDialog .stateSelector button:nth-child(4)'
      : '.interoperability-stages-dialog [data-state-choice="3"]';
    await page.evaluate((target) => {
      const button = document.querySelector(target);
      if (!button) throw new Error(`Interface control not found: ${target}`);
      button.click();
    }, selector);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    const diagram = page.locator(".stageBoundaryDiagram, .stage-boundary-diagram");
    await expect(diagram).toHaveAttribute("data-stage", "3");
    await expect(page.locator(selector)).toHaveAttribute("aria-pressed", "true");
    await page.close();
  });
}
