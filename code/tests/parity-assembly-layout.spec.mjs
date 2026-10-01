import { expect, test } from "@playwright/test";

const editions = [
  { name: "server", url: "http://127.0.0.1:3100/" },
  { name: "standalone", url: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href },
];

for (const edition of editions) {
  for (const viewport of [{ name: "desktop", width: 1440, height: 800 }, { name: "narrow", width: 390, height: 844 }]) {
    test(`${edition.name} KA uses one readable case scroller at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(edition.url, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
      await expect(page.getByRole("navigation", { name: "Teaching cases" })).toHaveCount(0);
      await page.getByRole("button", { name: "Orchestration", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Orchestration" })).toBeVisible();
      const casePane = page.locator(".assemblyCaseDetail, .assembly-case-detail");
      const cases = page.getByRole("navigation", { name: "Teaching cases" });
      await expect(casePane).toHaveAttribute("aria-label", "Case 1 details");
      await expect(cases.getByRole("button", { name: /^Case / })).toHaveCount(5);
      await casePane.getByRole("button", { name: /Inspect DFU Severity Score KO input, output, and handoff for Case 1/ }).click();
      const exchange = page.getByRole("dialog", { name: "DFU Severity Score KO Case 1 contribution" });
      await expect(exchange.getByRole("heading", { name: "Input" })).toBeVisible();
      await expect(exchange.getByRole("heading", { name: "Output" })).toBeVisible();
      await expect(exchange.getByRole("heading", { name: "Handoff" })).toBeVisible();
      await expect(exchange.getByText("Wagner grade 3:", { exact: false })).toBeVisible();
      await exchange.getByRole("button", { name: "Source" }).click();
      await expect(exchange.getByText('"wagner_score"', { exact: false })).toBeVisible();
      await exchange.getByRole("button", { name: "Close KO contribution" }).click();
      await expect(exchange).toHaveCount(0);
      const initial = await page.evaluate(() => {
        const pane = document.querySelector(".assemblyCaseDetail, .assembly-case-detail");
        const selector = document.querySelector(".assemblyCaseSelector, .assembly-case-selector");
        const buttons = [...selector.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
        return { paneClient: pane.clientHeight, paneScroll: pane.scrollHeight, bodyScroll: document.scrollingElement.scrollHeight,
          viewport: innerHeight, buttonTops: buttons.map((box) => box.top), buttonLefts: buttons.map((box) => box.left) };
      });
      if (viewport.name === "desktop") expect(initial.paneScroll).toBeLessThanOrEqual(initial.paneClient + 1);
      else expect(initial.paneScroll).toBeGreaterThan(initial.paneClient);
      expect(initial.bodyScroll).toBeLessThanOrEqual(initial.viewport + 2);
      if (viewport.name === "narrow") {
        expect(Math.max(...initial.buttonTops) - Math.min(...initial.buttonTops)).toBeLessThan(2);
        expect(initial.buttonLefts[4]).toBeGreaterThan(initial.buttonLefts[0]);
      }
      await expect(casePane.getByRole("heading", { name: "Assembly output" })).toBeVisible();
      for (let index = 2; index <= 5; index++) {
        await cases.getByRole("button", { name: `Case ${index}` }).click();
        await expect(casePane).toHaveAttribute("aria-label", `Case ${index} details`);
        await expect(casePane.getByRole("heading", { name: "Assembly output" })).toBeVisible();
        if (viewport.name === "desktop") {
          const dimensions = await casePane.evaluate((pane) => ({ client: pane.clientHeight, scroll: pane.scrollHeight }));
          expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
        }
      }
      await expect(casePane.getByText("No synthesis cell selected", { exact: false })).toHaveCount(0);
      await page.getByRole("button", { name: "Close orchestration" }).click();
      await expect(page.getByRole("dialog", { name: "Orchestration" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Orchestration", exact: true })).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }
}
