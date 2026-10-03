import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};

async function recoveryJourney(page, url) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  const panel = page.getByText("DFU Severity Score KO", { exact: true }).first().locator("xpath=ancestor::details[1]");
  await panel.getByRole("button", { name: "Interact", exact: true }).click();
  const interaction = page.getByRole("dialog", { name: "DFU Severity Score KO", exact: true });
  await expect(interaction).toBeVisible();

  await interaction.getByRole("button", { name: /existence\.metadata\.txt/ }).click();
  const fileError = interaction.locator(".metadataFileError, .metadata-file-error");
  await expect(fileError).toBeVisible();
  await expect(fileError).toContainText("existence.metadata.txt");
  await expect(interaction.getByRole("button", { name: "Close metadata interaction", exact: true })).toBeVisible();

  await interaction.getByRole("button", { name: /findability\.metadata\.txt/ }).click();
  await expect(fileError).toHaveCount(0);
  await expect(interaction.locator(".humanRdfTable, .human-rdf-table")).toBeVisible();

  await interaction.getByRole("button", { name: /existence\.metadata\.txt/ }).click();
  await expect(fileError).toBeVisible();
  await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).click();
  await expect(interaction).toHaveCount(0);
  expect(pageErrors, `${url} produced no uncaught browser errors`).toEqual([]);
}

test("both editions recover from a bad metadata file without trapping the user", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  await recoveryJourney(serverPage, editions.server);
  await recoveryJourney(standalonePage, editions.standalone);
  await serverPage.close();
  await standalonePage.close();
});
