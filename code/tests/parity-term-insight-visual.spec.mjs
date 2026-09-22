import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};

const objectName = "DFU Severity Score KO";
const viewports = {
  desktop: { width: 1440, height: 1000 },
  narrow: { width: 390, height: 844 },
};

const intersects = (left, right) => left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y;

async function panelFor(page, name) {
  return page.getByText(name, { exact: true }).first().locator("xpath=ancestor::details[1]");
}

async function openMetadataTable(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  const panel = await panelFor(page, objectName);
  await panel.getByRole("button", { name: "Interact", exact: true }).click();
  const interaction = page.getByRole("dialog", { name: objectName, exact: true });
  await expect(interaction).toBeVisible();
  const table = interaction.locator(".humanRdfTable, .human-rdf-table");
  await expect(table).toBeVisible();
  return { interaction, table };
}

async function verifyPreview(page, interaction, table) {
  const terms = [
    table.getByRole("button", { name: /^Inspect RDF subject:/ }).first(),
    table.getByRole("button", { name: /^Inspect RDF relationship:/ }).first(),
    table.getByRole("button", { name: /^Inspect RDF object:/ }).first(),
    table.getByRole("button", { name: /^Inspect RDF subject:/ }).last(),
  ];
  const placements = [];
  for (const term of terms) {
    await term.scrollIntoViewIfNeeded();
    await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).focus();
    await term.focus();
    const preview = page.getByRole("tooltip");
    await expect(preview).toBeVisible();
    const previewBox = await preview.boundingBox();
    const workspaceBox = await interaction.locator(".humanRdfView, .human-rdf-view").boundingBox();
    const viewport = page.viewportSize();
    expect(previewBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(previewBox.x).toBeGreaterThanOrEqual(Math.max(0, workspaceBox.x) - 1);
    expect(previewBox.y).toBeGreaterThanOrEqual(Math.max(0, workspaceBox.y) - 1);
    expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(Math.min(viewport.width, workspaceBox.x + workspaceBox.width) + 1);
    expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(Math.min(viewport.height, workspaceBox.y + workspaceBox.height) + 1);

    for (const control of [
      interaction.getByRole("button", { name: "Close metadata interaction", exact: true }),
      interaction.getByRole("button", { name: "Graph", exact: true }),
      interaction.getByRole("button", { name: "Table", exact: true }),
      interaction.getByRole("button", { name: "Source", exact: true }),
    ]) {
      const controlBox = await control.boundingBox();
      if (controlBox) expect(intersects(previewBox, controlBox)).toBe(false);
    }
    placements.push(await preview.getAttribute("data-placement"));
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
  }
  return placements;
}

async function verifyDetails(page, table) {
  await table.locator("xpath=ancestor::*[contains(@class,'tripleTableWrap') or contains(@class,'triple-table-wrap')][1]").evaluate((element) => {
    element.scrollTo({ left: 0, top: 0 });
  });
  const term = table.getByRole("button", { name: /^Inspect RDF subject:/ }).first();
  await term.scrollIntoViewIfNeeded();
  await term.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.keyboard.press("Enter");
  const details = page.locator(".rdfTermDetails, .rdf-term-details");
  await expect(details).toBeVisible();
  const body = details.locator(".rdfTermDetailsBody, .rdf-term-details-body");
  const relationships = details.locator(".termInsightRelationships, .term-insight-relationships");
  await expect(body).toBeVisible();
  await expect(relationships).toBeVisible();
  const groupCount = await relationships.locator(".termInsightRelationshipGroups > section, .term-insight-relationship-groups > section").count();
  expect(groupCount).toBeGreaterThan(1);
  const metrics = await page.locator(".rdfTermDetailsBackdrop, .rdf-term-details-backdrop").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  await page.locator(".rdfTermDetailsBackdrop, .rdf-term-details-backdrop").evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await expect(relationships.locator("li").last()).toBeVisible();
  return { details, groupCount, scrollable: metrics.scrollHeight > metrics.clientHeight };
}

for (const [size, viewport] of Object.entries(viewports)) {
  test(`Term Insight ${size} visual containment and edition parity`, async ({ browser }) => {
    test.setTimeout(60_000);
    const results = {};
    for (const [edition, url] of Object.entries(editions)) {
      const page = await browser.newPage({ viewport, colorScheme: "light", reducedMotion: "reduce" });
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const { interaction, table } = await openMetadataTable(page, url);
      const previewTerm = table.getByRole("button", { name: /^Inspect RDF subject:/ }).first();
      await previewTerm.focus();
      await expect(page.getByRole("tooltip")).toBeVisible();
      await expect(page).toHaveScreenshot(`${edition}-term-preview-${size}.png`, {
        animations: "disabled", caret: "hide", fullPage: false, maxDiffPixelRatio: 0.002, scale: "css",
      });
      await page.keyboard.press("Escape");
      const placements = await verifyPreview(page, interaction, table);
      const { details, groupCount, scrollable } = await verifyDetails(page, table);
      await page.locator(".rdfTermDetailsBackdrop, .rdf-term-details-backdrop").evaluate((element) => element.scrollTo(0, 0));
      await expect(page).toHaveScreenshot(`${edition}-term-details-${size}.png`, {
        animations: "disabled", caret: "hide", fullPage: false, maxDiffPixelRatio: 0.002, scale: "css",
      });
      await details.getByRole("button", { name: "Close term details", exact: true }).click();
      await expect(table).toBeVisible();
      expect(pageErrors, `${edition} ${size} produced no uncaught browser errors`).toEqual([]);
      results[edition] = { placements, groupCount, scrollable };
      await page.close();
    }
    expect(results.standalone).toEqual(results.server);
  });
}
