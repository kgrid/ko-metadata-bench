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
