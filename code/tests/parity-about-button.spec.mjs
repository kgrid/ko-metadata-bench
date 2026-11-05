import { expect, test } from "@playwright/test";

const editions = [
  { name: "server", url: "http://127.0.0.1:3100/" },
  { name: "standalone", url: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href },
];

for (const edition of editions) {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "narrow", width: 390, height: 844 }]) {
    test(`${edition.name} places About beside Workshop Abstract at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(edition.url, { waitUntil: "domcontentloaded" });
      const about = page.getByRole("button", { name: "About this Bench", exact: true });
      const abstract = page.getByRole("button", { name: "Workshop Abstract" });
      await expect(about).toHaveText("About this Bench");
      await expect(about).toBeEnabled();
      const [aboutBox, abstractBox] = await Promise.all([about.boundingBox(), abstract.boundingBox()]);
      expect(aboutBox.width).toBe(abstractBox.width);
      expect(aboutBox.height).toBe(abstractBox.height);
      expect(Math.abs(aboutBox.y - abstractBox.y)).toBeLessThanOrEqual(1);
      expect(aboutBox.x + aboutBox.width).toBeLessThan(abstractBox.x);
      expect(abstractBox.x - (aboutBox.x + aboutBox.width)).toBeLessThanOrEqual(16);
      await about.click();
      const dialog = page.getByRole("dialog", { name: "About this Bench" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "What is a Knowledge Object?" })).toBeVisible();
      await expect(dialog).toContainText("Created by the Knowledge Systems Lab");
      await expect(dialog.getByRole("link", { name: /Workbench repository/ })).toHaveAttribute("href", "https://github.com/kgrid/ko-metadata-bench");
      await expect(dialog.getByRole("button", { name: "Close About this Bench" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(about).toBeFocused();
      await abstract.click();
      await expect(page.getByRole("dialog", { name: "Workshop Abstract" })).toBeVisible();
    });
  }
}
