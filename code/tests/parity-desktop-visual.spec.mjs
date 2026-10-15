import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
  reducedMotion: "reduce",
});

const editions = [
  { name: "server", url: "http://127.0.0.1:3100/" },
  { name: "standalone", url: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href },
];

const views = [
  { key: "knowledge-objects", heading: "Knowledge Objects", control: null },
  { key: "metadata", heading: "Metadata", control: "Metadata Rig" },
  { key: "findability", heading: "Findability", control: "F exercise" },
  { key: "accessibility", heading: "Access", control: "A exercise" },
  { key: "interoperability", heading: "Interoperability", control: "I exercise" },
  { key: "reusability", heading: "Reusability", control: "R exercise" },
];

async function settleVisualState(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(100);
}

for (const edition of editions) {
  test(`${edition.name} desktop principal-view baselines`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });

    for (const view of views) {
      if (view.control) await page.getByRole("button", { name: view.control, exact: true }).click();
      await expect(page.getByRole("heading", { name: view.heading, exact: true })).toBeVisible();
      await settleVisualState(page);
      await expect(page).toHaveScreenshot(`${edition.name}-${view.key}-desktop.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: false,
        maxDiffPixelRatio: 0.002,
        scale: "css",
      });
    }

    expect(pageErrors, `${edition.name} produced no uncaught browser errors`).toEqual([]);
  });
}
