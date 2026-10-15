import { expect, test } from "@playwright/test";

const editions = [
  { name: "server", url: "http://127.0.0.1:3100/" },
  { name: "standalone", url: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href },
];

for (const edition of editions) {
  for (const viewport of [{ name: "desktop", width: 1440, height: 800 }, { name: "narrow", width: 390, height: 844 }]) {
    test(`${edition.name} orchestration opens with four pieces and four empty positions at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(edition.url, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
      await page.getByRole("button", { name: "Orchestration", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Orchestration" });
      await expect(dialog).toBeVisible();
      const pieces = dialog.getByRole("complementary", { name: "Knowledge Objects to assemble" });
      const board = dialog.getByRole("region", { name: "Assembly puzzle" });
      await expect(pieces.locator("[data-assembly-piece]")).toHaveCount(4);
      expect((await pieces.locator("[data-assembly-piece]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-assembly-piece")))).sort()).toEqual(["burden", "decision", "margolis", "wagner"]);
      await expect(board.locator("[data-assembly-slot]")).toHaveCount(4);
      await expect(board.locator("[data-assembly-slot]")).toHaveText(["Place KO here", "Place KO here", "Place KO here", "Place KO here"]);
      await expect(board.locator(".assemblyFlowToAssembly .assemblyFlowArrow, .assembly-flow-to-assembly .assembly-flow-arrow")).toHaveCount(3);
      await expect(dialog.getByRole("navigation", { name: "Teaching cases" })).toHaveCount(0);
      await expect(dialog.locator(".assemblyCaseDetail, .assembly-case-detail")).toHaveCount(0);
      await expect(dialog.getByText("Assembly decisions", { exact: true })).toBeVisible();
      const dimensions = await page.evaluate(() => ({ bodyScroll: document.scrollingElement.scrollHeight, viewport: innerHeight }));
      expect(dimensions.bodyScroll).toBeLessThanOrEqual(dimensions.viewport + 2);
      await page.getByRole("button", { name: "Close orchestration" }).click();
      await expect(dialog).toHaveCount(0);
      expect(pageErrors).toEqual([]);
    });
  }
  test(`${edition.name} puzzle supports drag, keyboard placement, swapping, and returning a KO`, async ({ page }) => {
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    await page.getByRole("button", { name: "Orchestration", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Orchestration" });
    const pieces = dialog.getByRole("complementary", { name: "Knowledge Objects to assemble" });
    const board = dialog.getByRole("region", { name: "Assembly puzzle" });
    const slot = (index) => board.locator(`[data-assembly-slot="slot-${index}"]`);

    await pieces.locator('[data-assembly-piece="wagner"]').dragTo(slot(1));
    await expect(slot(1)).toContainText("DFU Severity Score KO");
    await expect(pieces.locator('[data-assembly-piece="wagner"]')).toHaveCount(0);

    await pieces.locator('[data-assembly-piece="decision"]').focus();
    await page.keyboard.press("Enter");
    await slot(2).focus();
    await page.keyboard.press("Enter");
    await expect(slot(2)).toContainText("HBOT Treatment Decision KO");

    await slot(1).dragTo(slot(2));
    await expect(slot(1)).toContainText("HBOT Treatment Decision KO");
    await expect(slot(2)).toContainText("DFU Severity Score KO");
    await slot(2).dragTo(slot(3));
    await expect(slot(2)).toContainText("Place KO here");
    await expect(slot(3)).toContainText("DFU Severity Score KO");
    await expect(board.locator(".assemblyPuzzleMessage.unworkable, .assembly-puzzle-message.unworkable")).toHaveCount(0);
    await slot(3).dragTo(slot(2));

    await slot(2).focus();
    await page.keyboard.press("Enter");
    await pieces.getByRole("button", { name: "Return selected KO here" }).click();
    await expect(slot(2)).toContainText("Place KO here");
    await expect(pieces.locator('[data-assembly-piece="wagner"]')).toBeVisible();
    await expect(dialog.getByRole("navigation", { name: "Teaching cases" })).toHaveCount(0);
  });
  test(`${edition.name} judges the dependency only when all four slots are filled`, async ({ page }) => {
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    await page.getByRole("button", { name: "Orchestration", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Orchestration" });
    const source = dialog.getByRole("complementary", { name: "Knowledge Objects to assemble" });
    const board = dialog.getByRole("region", { name: "Assembly puzzle" });
    const startingOrder = await source.locator("[data-assembly-piece]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-assembly-piece")));
    const slot = (index) => board.locator(`[data-assembly-slot="slot-${index}"]`);
    const place = async (role, index) => {
      await source.locator(`[data-assembly-piece="${role}"]`).click();
      await slot(index).click();
    };
    await place("decision", 1);
    await place("wagner", 2);
    await place("margolis", 3);
    await expect(board.locator(".assemblyPuzzleMessage.unworkable, .assembly-puzzle-message.unworkable")).toHaveCount(0);
    await place("burden", 4);
    await expect(board.getByRole("status")).toContainText("cannot work");
    await expect(source.locator("[data-assembly-piece]")).toHaveCount(4);
    expect(await source.locator("[data-assembly-piece]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-assembly-piece")))).toEqual(startingOrder);
    await expect(board.locator("[data-assembly-slot]")).toHaveText(["Place KO here", "Place KO here", "Place KO here", "Place KO here"]);
    await expect(board.getByRole("status")).toContainText("All four KOs have returned to the starting area. Try again.");
    await expect(source.locator("[data-assembly-piece]").first()).toBeFocused();
    await place("wagner", 1);
    await place("decision", 2);
    await place("margolis", 3);
    await place("burden", 4);
    await expect(board).toHaveCount(0);
    const cases = dialog.getByRole("navigation", { name: "Teaching cases" });
    await expect(cases.getByRole("button", { name: "Case 1" })).toBeVisible();
    await expect(cases.getByRole("button", { name: "Case 1" })).toBeFocused();
    const casePane = dialog.locator(".assemblyCaseDetail, .assembly-case-detail");
    await expect(casePane).toHaveAttribute("aria-label", "Case 1 details");
    await expect(casePane.locator(".assemblyKoModule, .assembly-ko-module")).toHaveCount(4);
    await expect(casePane.locator(".assemblyFlowArrow, .assembly-flow-arrow")).toHaveCount(3);
    await expect(casePane.getByRole("button", { name: /^Inspect .* input, output, and handoff for Case 1$/ })).toHaveCount(4);
    await expect(casePane.locator(".assemblyMatrixCell.selected, .assembly-matrix-cell.selected")).toHaveCount(1);
    await casePane.getByRole("button", { name: /Inspect DFU Severity Score KO input, output, and handoff for Case 1/ }).click();
    const exchange = page.getByRole("dialog", { name: "DFU Severity Score KO Case 1 contribution" });
    await expect(exchange.getByRole("heading", { name: "Input", exact: true })).toBeVisible();
    await expect(exchange.getByRole("heading", { name: "Output", exact: true })).toBeVisible();
    await expect(exchange.getByRole("heading", { name: "Handoff", exact: true })).toBeVisible();
    await exchange.getByRole("button", { name: "Close KO contribution" }).click();
    await cases.getByRole("button", { name: "Case 2" }).click();
    await expect(casePane).toHaveAttribute("aria-label", "Case 2 details");
  });
  test(`${edition.name} accepts the swapped independent KOs using keyboard placement`, async ({ page }) => {
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    await page.getByRole("button", { name: "Orchestration", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Orchestration" });
    const source = dialog.getByRole("complementary", { name: "Knowledge Objects to assemble" });
    const board = dialog.getByRole("region", { name: "Assembly puzzle" });
    for (const [role, index] of [["wagner", 1], ["decision", 2], ["burden", 3], ["margolis", 4]]) {
      await source.locator(`[data-assembly-piece="${role}"]`).focus();
      await page.keyboard.press("Enter");
      await board.locator(`[data-assembly-slot="slot-${index}"]`).focus();
      await page.keyboard.press("Enter");
      if (index < 4) {
        await expect(dialog.getByRole("navigation", { name: "Teaching cases" })).toHaveCount(0);
        await expect(board.locator(".assemblyPuzzleMessage.unworkable, .assembly-puzzle-message.unworkable")).toHaveCount(0);
      }
    }
    await expect(board).toHaveCount(0);
    const cases = dialog.getByRole("navigation", { name: "Teaching cases" });
    await expect(cases.getByRole("button", { name: "Case 1" })).toBeFocused();
    await expect(dialog.locator(".assemblyCaseDetail, .assembly-case-detail")).toHaveAttribute("aria-label", "Case 1 details");
  });
  test(`${edition.name} reload clears partial and completed puzzle state`, async ({ page }) => {
    const open = async () => {
      await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
      await page.getByRole("button", { name: "Orchestration", exact: true }).click();
      return page.getByRole("dialog", { name: "Orchestration" });
    };
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });
    let dialog = await open();
    await dialog.locator('[data-assembly-piece="wagner"]').click();
    await dialog.locator('[data-assembly-slot="slot-1"]').click();
    await page.reload({ waitUntil: "domcontentloaded" });
    dialog = await open();
    await expect(dialog.locator("[data-assembly-piece]")).toHaveCount(4);
    await expect(dialog.locator("[data-assembly-slot]")).toHaveText(["Place KO here", "Place KO here", "Place KO here", "Place KO here"]);
    for (const [role, index] of [["wagner", 1], ["decision", 2], ["margolis", 3], ["burden", 4]]) {
      await dialog.locator(`[data-assembly-piece="${role}"]`).click();
      await dialog.locator(`[data-assembly-slot="slot-${index}"]`).click();
    }
    await expect(dialog.getByRole("navigation", { name: "Teaching cases" })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    dialog = await open();
    await expect(dialog.getByRole("navigation", { name: "Teaching cases" })).toHaveCount(0);
    await expect(dialog.locator("[data-assembly-piece]")).toHaveCount(4);
    await expect(dialog.locator("[data-assembly-slot]")).toHaveText(["Place KO here", "Place KO here", "Place KO here", "Place KO here"]);
  });
}

test("server and standalone retain the same Case 1 orchestration after valid placement", async ({ page }) => {
  const presentations = [];
  for (const edition of editions) {
    await page.goto(edition.url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    await page.getByRole("button", { name: "Orchestration", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Orchestration" });
    for (const [role, index] of [["wagner", 1], ["decision", 2], ["margolis", 3], ["burden", 4]]) {
      await dialog.locator(`[data-assembly-piece="${role}"]`).click();
      await dialog.locator(`[data-assembly-slot="slot-${index}"]`).click();
    }
    const detail = dialog.locator(".assemblyCaseDetail, .assembly-case-detail");
    await expect(detail).toHaveAttribute("aria-label", "Case 1 details");
    presentations.push(await detail.evaluate((node) => ({
      text: node.innerText.replace(/\s+/g, " ").trim(),
      selected: node.querySelector(".assemblyMatrixCell.selected, .assembly-matrix-cell.selected")?.textContent.replace(/\s+/g, " ").trim(),
      ioCount: node.querySelectorAll(".assemblyKoInspectButton, .assembly-ko-inspect-button").length,
    })));
  }
  expect(presentations[0]).toEqual(presentations[1]);
});
