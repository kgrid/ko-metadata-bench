import { expect, test } from "@playwright/test";

const editions = [
  { name: "server", url: "http://127.0.0.1:3100/" },
  { name: "standalone", url: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href },
];

for (const edition of editions) {
  test(`${edition.name} shows bubbles only on eligible banner names`, async ({ page }) => {
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });
    const views = [
      { control: "Knowledge Objects", label: "Knowledge Objects explorer" },
      { control: "Metadata Rig", label: "Metadata rig" },
      { control: "K exercise", label: "Knowledge exercise" },
      { control: "F exercise", label: "Findability exercise" },
      { control: "A exercise", label: "Accessibility exercise" },
      { control: "I exercise", label: "Interoperability exercise" },
      { control: "R exercise", label: "Reusability exercise" },
    ];
    for (const view of views) {
      await page.getByRole("button", { name: view.control, exact: true }).click();
      const root = page.getByRole("region", { name: view.label });
      const anchor = root.locator("summary > strong .acronymBubbleAnchor").first();
      await expect(anchor).toHaveText("DFU");
      await expect(anchor).not.toHaveAttribute("title", /.+/);
      const banner = anchor.locator("xpath=ancestor::summary[1]");
      const before = await banner.boundingBox();
      await anchor.hover();
      await expect(page.getByRole("tooltip")).toHaveText("Diabetic Foot Ulcer");
      const after = await banner.boundingBox();
      expect(after).toEqual(before);
      await page.mouse.move(0, 0);
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      const panel = banner.locator("xpath=ancestor::details[1]");
      await anchor.click();
      await expect(panel).toHaveAttribute("open", "");
      await anchor.click();
      await expect(panel).not.toHaveAttribute("open", "");
    }
    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    const assembly = page.getByRole("region", { name: "Knowledge Assembly explorer" });
    const ka = assembly.locator(".assemblyObjectBar, .assembly-object-bar");
    const kaAcronym = ka.locator(".acronymBubbleAnchor");
    await expect(kaAcronym).toHaveText("HBOT");
    expect(await kaAcronym.evaluate((node) => {
      const style = getComputedStyle(node);
      const nameStyle = getComputedStyle(node.parentElement);
      return {
        transparent: style.backgroundColor === "rgba(0, 0, 0, 0)",
        border: style.borderTopWidth,
        padding: style.paddingLeft,
        sameSize: style.fontSize === nameStyle.fontSize,
        uppercase: style.textTransform === "uppercase",
      };
    })).toEqual({ transparent: true, border: "0px", padding: "0px", sameSize: true, uppercase: false });
    await expect(ka.getByRole("button", { name: "Orchestration" })).toHaveCSS("border-top-width", "1px");
    await ka.getByRole("button", { name: "Orchestration" }).click();
    await expect(page.getByRole("dialog", { name: "Orchestration" })).toBeVisible();
    await page.getByRole("button", { name: "Close orchestration" }).click();
    await expect(ka.locator(".acronymBubbleAnchor")).toHaveText("HBOT");
  });

  test(`${edition.name} bubble stays in view at narrow width and respects keyboard focus`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });
    const anchor = page.locator('section[aria-label="Knowledge Objects explorer"] summary > strong .acronymBubbleAnchor').last();
    await expect(anchor).toHaveText("DFU");
    await anchor.focus();
    const bubble = page.getByRole("tooltip");
    await expect(bubble).toHaveText("Diabetic Foot Ulcer");
    const rect = await bubble.boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(390);
    await page.keyboard.press("Escape");
    await expect(bubble).toHaveCount(0);
  });
}
