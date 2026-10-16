import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};
const fileButton = (interaction, name) => interaction.locator(`.fileButton[title="${name}"], .file[data-file="${name}"]`);
const rdfTable = (interaction) => interaction.locator(".humanRdfTable, .human-rdf-table");

async function metadataFileJourney(page, url) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  const panel = page.getByText("DFU Severity Score KO", { exact: true }).first().locator("xpath=ancestor::details[1]");
  await panel.getByRole("button", { name: "Interact", exact: true }).click();
  const interaction = page.getByRole("dialog", { name: "DFU Severity Score KO", exact: true });
  await expect(interaction).toBeVisible();
  await fileButton(interaction, "existence.metadata.txt").click();
  const fileError = interaction.locator(".metadataFileError, .metadata-file-error");
  await expect(fileError).toHaveCount(0);
  await expect(rdfTable(interaction)).toBeVisible();
  await expect(interaction.getByRole("button", { name: "Close metadata interaction", exact: true })).toBeVisible();

  await fileButton(interaction, "findability.metadata.txt").click();
  await expect(fileError).toHaveCount(0);
  await expect(rdfTable(interaction)).toBeVisible();

  await fileButton(interaction, "existence.metadata.txt").click();
  await expect(fileError).toHaveCount(0);
  await expect(rdfTable(interaction)).toBeVisible();
  await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).click();
  await expect(interaction).toHaveCount(0);
  expect(pageErrors, `${url} produced no uncaught browser errors`).toEqual([]);
}

test("both editions display existence metadata and keep file switching available", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  await metadataFileJourney(serverPage, editions.server);
  await metadataFileJourney(standalonePage, editions.standalone);
  await serverPage.close();
  await standalonePage.close();
});

async function malformedFileJourney(page, url) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  const panel = page.getByText("DFU Severity Score KO", { exact: true }).first().locator("xpath=ancestor::details[1]");
  await panel.getByRole("button", { name: "Interact", exact: true }).click();
  const interaction = page.getByRole("dialog", { name: "DFU Severity Score KO", exact: true });
  await expect(interaction).toBeVisible();
  await fileButton(interaction, "existence.metadata.txt").click();
  await expect(rdfTable(interaction)).toBeVisible();

  // Make only this test page's working copy invalid; the embedded KO remains intact.
  await interaction.getByRole("button", { name: "Source", exact: true }).click();
  const sourceEditor = interaction.getByRole("textbox", { name: /Editing existence\.metadata\.txt/ });
  const original = await sourceEditor.inputValue();
  await sourceEditor.fill(`${original}\n<https://example.org/broken> <https://schema.org/name> .`);
  await interaction.getByRole("button", { name: "Table", exact: true }).click();
  const fileError = interaction.locator(".metadataFileError, .metadata-file-error, .invalid-rdf-source");
  await expect(fileError).toBeVisible();
  await expect(interaction.getByRole("button", { name: "Close metadata interaction", exact: true })).toBeVisible();

  await fileButton(interaction, "findability.metadata.txt").click();
  await expect(fileError).toHaveCount(0);
  await expect(rdfTable(interaction)).toBeVisible();
  await fileButton(interaction, "existence.metadata.txt").click();
  await expect(fileError).toBeVisible();
  await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).click();
  await expect(interaction).toHaveCount(0);
  expect(pageErrors, `${url} produced no uncaught browser errors`).toEqual([]);
}

test("both editions recover from a malformed working metadata file", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  await malformedFileJourney(serverPage, editions.server);
  await malformedFileJourney(standalonePage, editions.standalone);
  await serverPage.close();
  await standalonePage.close();
});

async function findabilityIdentityFilterJourney(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  const panel = page.getByText("DFU Severity Score KO", { exact: true }).first().locator("xpath=ancestor::details[1]");
  await panel.getByRole("button", { name: "Interact", exact: true }).click();
  const interaction = page.getByRole("dialog", { name: "DFU Severity Score KO", exact: true });
  await fileButton(interaction, "findability.metadata.txt").click();
  await interaction.getByRole("button", { name: "Findability Principles" }).click();
  const koFilter = interaction.getByRole("button", { name: "Unique KO ID", exact: true });
  const metadataFilter = interaction.getByRole("button", { name: "Unique KO Metadata ID", exact: true });
  const rows = rdfTable(interaction).locator("tbody > tr[data-statement-id]");
  const unfilteredCount = await rows.count();
  expect(unfilteredCount).toBeGreaterThan(2);
  const unfilteredIds = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-statement-id")));
  const koSubject = unfilteredIds[0]?.split(" ")[0];
  const expectedIdentityIds = unfilteredIds.filter((id) => id?.startsWith(`${koSubject} `)
    && (id.includes("https://schema.org/identifier") || id.includes("https://schema.org/version")));
  const expectedMetadataIds = unfilteredIds.filter((id) => id?.startsWith(`${koSubject} `)
    && id.includes("https://schema.org/subjectOf"));
  expect(expectedIdentityIds.length).toBeGreaterThanOrEqual(2);
  expect(expectedMetadataIds).toHaveLength(1);
  await expect(koFilter).toHaveAttribute("aria-pressed", "false");
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "false");
  await koFilter.click();
  await expect(koFilter).toHaveAttribute("aria-pressed", "true");
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "false");
  await expect(koFilter).toHaveClass(/active/);
  await expect(rows).toHaveCount(expectedIdentityIds.length);
  const statementIds = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-statement-id")));
  expect(statementIds).toEqual(expectedIdentityIds);
  expect(statementIds.some((id) => id.includes("https://schema.org/identifier"))).toBe(true);
  expect(statementIds.some((id) => id.includes("https://schema.org/version"))).toBe(true);
  await interaction.getByRole("button", { name: "Source", exact: true }).click();
  await interaction.getByRole("button", { name: "Table", exact: true }).click();
  await expect(rows).toHaveCount(expectedIdentityIds.length);
  await metadataFilter.click();
  await expect(koFilter).toHaveAttribute("aria-pressed", "true");
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "true");
  await expect(metadataFilter).toHaveClass(/active/);
  await expect(rows).toHaveCount(expectedIdentityIds.length + expectedMetadataIds.length);
  expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-statement-id")))).toEqual(unfilteredIds.filter((id) => expectedIdentityIds.includes(id) || expectedMetadataIds.includes(id)));
  await koFilter.click();
  await expect(koFilter).toHaveAttribute("aria-pressed", "false");
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "true");
  expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-statement-id")))).toEqual(expectedMetadataIds);
  await expect(rows.first().locator("td").nth(1)).toHaveText("subject of");
  await metadataFilter.click();
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "false");
  await expect(rows).toHaveCount(unfilteredCount);
  await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).click();
}

test("both editions independently toggle KO and metadata identity filters without changing source", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  await findabilityIdentityFilterJourney(serverPage, editions.server);
  await findabilityIdentityFilterJourney(standalonePage, editions.standalone);
  await serverPage.close();
  await standalonePage.close();
});
