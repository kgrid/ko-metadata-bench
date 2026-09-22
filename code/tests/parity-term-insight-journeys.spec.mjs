import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};

const objectName = "DFU Severity Score KO";

async function panelFor(page, name) {
  return page.getByText(name, { exact: true }).first().locator("xpath=ancestor::details[1]");
}

async function termInsightJourney(page, url) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Metadata", exact: true })).toBeVisible();

  const panel = await panelFor(page, objectName);
  await panel.getByRole("button", { name: "Interact", exact: true }).click();
  const interaction = page.getByRole("dialog", { name: objectName, exact: true });
  await expect(interaction).toBeVisible();
  const table = interaction.locator(".humanRdfTable, .human-rdf-table");
  await expect(table).toBeVisible();

  const term = table.getByRole("button", { name: /^Inspect RDF subject:/ }).first();
  await expect(term).toBeVisible();

  // Hover deliberately waits before revealing its preview.
  await term.hover();
  await page.waitForTimeout(150);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const hoverPreview = page.getByRole("tooltip");
  await expect(hoverPreview).toBeVisible({ timeout: 800 });
  const hoverLabel = (await hoverPreview.locator("strong").textContent())?.trim();
  const hoverExplanation = (await hoverPreview.locator("p").textContent())?.trim();
  expect(hoverLabel).toBeTruthy();
  expect(hoverExplanation).toBeTruthy();

  // Escape dismisses the preview, and keyboard focus can open it again.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(interaction).toBeVisible();
  await expect(table).toBeVisible();
  await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).focus();
  await term.focus();
  const focusPreview = page.getByRole("tooltip");
  await expect(focusPreview).toBeVisible();
  await expect(term).toHaveAttribute("aria-describedby", await focusPreview.getAttribute("id"));
  expect((await focusPreview.locator("strong").textContent())?.trim()).toBe(hoverLabel);
  expect((await focusPreview.locator("p").textContent())?.trim()).toBe(hoverExplanation);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  // Clicking pins the same semantic content in the full-page Term Details view.
  await term.click();
  const details = page.locator(".rdfTermDetails, .rdf-term-details");
  await expect(details).toBeVisible();
  await expect(details).toHaveAttribute("role", "dialog");
  const detailsLabel = (await details.getByRole("heading", { level: 2 }).textContent())?.trim();
  const meaning = details.locator(".termInsightMeaning p, .term-insight-meaning p");
  const detailsExplanation = (await meaning.textContent())?.trim();
  expect(detailsLabel).toBe(hoverLabel);
  expect(detailsExplanation).toBe(hoverExplanation);

  const relationships = details.locator(".termInsightRelationships, .term-insight-relationships");
  await expect(relationships.getByRole("heading", { name: "Local relationships", exact: true })).toBeVisible();
  const relationshipSummary = (await relationships.locator(":scope > header > span").textContent()) ?? "";
  const counts = relationshipSummary.match(/(\d+) outgoing · (\d+) incoming/);
  expect(counts).not.toBeNull();
  const expectedRelationships = Number(counts[1]) + Number(counts[2]);
  await expect(relationships.locator("li")).toHaveCount(expectedRelationships);

  const source = details.getByRole("link", { name: /Open Source/ });
  await expect(source).toBeVisible();
  const sourceHref = await source.getAttribute("href");
  expect(sourceHref).toMatch(/^https?:\/\//);
  expect(await source.getAttribute("rel")).toContain("noopener");

  await details.getByRole("button", { name: "Close term details", exact: true }).click();
  await expect(details).toHaveCount(0);
  await expect(table).toBeVisible();
  await expect(term).toBeFocused();
  expect(errors, `${url} produced no uncaught browser errors`).toEqual([]);

  return {
    label: hoverLabel,
    explanation: hoverExplanation,
    relationshipSummary,
    relationshipCount: expectedRelationships,
    sourceHref,
  };
}

test("server and standalone editions share complete Term Insight journeys", async ({ browser }) => {
  test.setTimeout(60_000);
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  const server = await termInsightJourney(serverPage, editions.server);
  const standalone = await termInsightJourney(standalonePage, editions.standalone);
  expect(standalone).toEqual(server);
  await serverPage.close();
  await standalonePage.close();
});
