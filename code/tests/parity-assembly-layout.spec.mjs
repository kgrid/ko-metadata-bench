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
      const casePane = page.locator(".assemblyCaseDetail, .assembly-case-detail");
      const cases = page.getByRole("navigation", { name: "Teaching cases" });
      await expect(casePane).toHaveAttribute("aria-label", "Case 1 details");
      await expect(cases.getByRole("button", { name: /^Case / })).toHaveCount(5);
      const initial = await page.evaluate(() => {
        const pane = document.querySelector(".assemblyCaseDetail, .assembly-case-detail");
        const selector = document.querySelector(".assemblyCaseSelector, .assembly-case-selector");
        const buttons = [...selector.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
        return { paneClient: pane.clientHeight, paneScroll: pane.scrollHeight, bodyScroll: document.scrollingElement.scrollHeight,
          viewport: innerHeight, buttonTops: buttons.map((box) => box.top), buttonLefts: buttons.map((box) => box.left) };
      });
      expect(initial.paneScroll).toBeGreaterThan(initial.paneClient);
      expect(initial.bodyScroll).toBeLessThanOrEqual(initial.viewport + 2);
      if (viewport.name === "narrow") {
        expect(Math.max(...initial.buttonTops) - Math.min(...initial.buttonTops)).toBeLessThan(2);
        expect(initial.buttonLefts[4]).toBeGreaterThan(initial.buttonLefts[0]);
      }
      await casePane.evaluate((pane) => { pane.scrollTop = pane.scrollHeight; });
      await expect(casePane.getByRole("heading", { name: "Final classification" })).toBeVisible();
      await cases.getByRole("button", { name: "Case 4" }).click();
      await expect(casePane.getByText("Synthesis stops here")).toBeVisible();
      await expect(casePane.getByRole("heading", { name: "Synthesis rule" })).toHaveCount(0);
      expect(pageErrors).toEqual([]);
    });
  }
}
