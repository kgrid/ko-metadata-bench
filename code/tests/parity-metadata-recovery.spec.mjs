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

async function accessFilterJourney(page, url) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  const panel = page.getByText("DFU Severity Score KO", { exact: true }).first().locator("xpath=ancestor::details[1]");
  await panel.getByRole("button", { name: "Interact", exact: true }).click();
  const interaction = page.getByRole("dialog", { name: "DFU Severity Score KO", exact: true });
  await fileButton(interaction, "access.metadata.txt").click();
  const table = rdfTable(interaction);
  const rows = table.locator("tbody > tr[data-statement-id]");
  await expect(table).toBeVisible();
  const unfilteredCount = await rows.count();
  await interaction.getByRole("button", { name: "Accessibility Principles" }).click();
  const koFilter = interaction.getByRole("button", { name: "KO Access", exact: true });
  const metadataFilter = interaction.getByRole("button", { name: "KO Metadata Access", exact: true });
  await expect(koFilter).toHaveAttribute("aria-pressed", "false");
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "false");
  await koFilter.click();
  await expect(koFilter).toHaveAttribute("aria-pressed", "true");
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "false");
  await expect(rows).toHaveCount(2);
  await expect(rows.locator("td:nth-child(2)")).toHaveText(["access instance", "access instance"]);
  await expect(table).toContainText("Open tagged repository directory through HTTPS");
  await expect(table).toContainText("Download from FDO Bench");
  await expect(table).not.toContainText("View existence metadata through HTTPS");
  await metadataFilter.click();
  await expect(koFilter).toHaveAttribute("aria-pressed", "true");
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "true");
  await expect(rows).toHaveCount(3);
  await expect(rows.locator("td:nth-child(2)")).toHaveText(["access instance", "access instance", "access instance"]);
  await expect(table).toContainText("View existence metadata through HTTPS");
  await koFilter.click();
  await expect(koFilter).toHaveAttribute("aria-pressed", "false");
  await expect(metadataFilter).toHaveAttribute("aria-pressed", "true");
  await expect(rows).toHaveCount(1);
  await expect(table).not.toContainText("Download from FDO Bench");
  await interaction.getByRole("button", { name: "Source", exact: true }).click();
  await expect(interaction.getByRole("textbox", { name: /Editing access\.metadata\.txt/ })).toHaveValue(/Download from FDO Bench/);
  await interaction.getByRole("button", { name: "Table", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await metadataFilter.click();
  await expect(rows).toHaveCount(unfilteredCount);
  expect(pageErrors, `${url} produced no uncaught browser errors`).toEqual([]);
  await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).click();
}

test("both editions independently filter KO and metadata access routes", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  await accessFilterJourney(serverPage, editions.server);
  await accessFilterJourney(standalonePage, editions.standalone);
  await serverPage.close();
  await standalonePage.close();
});

async function interoperabilityFilterJourney(page, url, loadAssembly = false) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (loadAssembly) {
    await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
    await page.getByRole("button", { name: "Load as Knowledge Object", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Loaded as a Knowledge Object");
  }
  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  const name = loadAssembly ? "HBOT Treatment Target KA" : "DFU Severity Score KO";
  const panels = page.locator("details.metadataRigCard, details.metadata-rig-card");
  await expect(panels).toHaveCount(loadAssembly ? 5 : 4);
  const panel = loadAssembly ? panels.last() : panels.first();
  await expect(panel).toContainText(name);
  await panel.getByRole("button", { name: "Interact", exact: true }).click();
  const interaction = page.getByRole("dialog", { name, exact: true });
  await fileButton(interaction, "interoperability.metadata.txt").click();
  const table = rdfTable(interaction);
  const rows = table.locator("tbody > tr[data-statement-id]");
  await expect(table).toBeVisible();
  const unfilteredCount = await rows.count();
  expect(unfilteredCount).toBeGreaterThan(7);
  await interaction.getByRole("button", { name: "Interoperability Principles" }).click();
  const interfaceFilter = interaction.getByRole("button", { name: "Specified Interface", exact: true });
  const referencesFilter = interaction.getByRole("button", { name: "Object References", exact: true });
  await expect(interfaceFilter).toHaveAttribute("aria-pressed", "false");
  await expect(referencesFilter).toHaveAttribute("aria-pressed", "false");
  await interfaceFilter.click();
  await expect(interfaceFilter).toHaveAttribute("aria-pressed", "true");
  await expect(referencesFilter).toHaveAttribute("aria-pressed", "false");
  await expect(rows).toHaveCount(2);
  const interfaceIds = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-statement-id")));
  expect(interfaceIds.some((id) => id.includes("https://schema.org/potentialAction"))).toBe(true);
  expect(interfaceIds.some((id) => id.includes("https://schema.org/target"))).toBe(true);
  expect(interfaceIds.find((id) => id.includes("https://schema.org/potentialAction"))).toContain(loadAssembly ? "github.com/kgrid-objects/FAIR-DO-Workshop/tree/hbot-treatment-target-ka" : "https://kgrid.org/cks/");
  await expect(table.locator("tr.interoperabilityCksSubject, tr.interoperability-cks-subject")).toHaveCount(loadAssembly ? 0 : 1);
  await referencesFilter.click();
  await expect(interfaceFilter).toHaveAttribute("aria-pressed", "true");
  await expect(referencesFilter).toHaveAttribute("aria-pressed", "true");
  await expect(rows).toHaveCount(7);
  await interfaceFilter.click();
  await expect(interfaceFilter).toHaveAttribute("aria-pressed", "false");
  await expect(referencesFilter).toHaveAttribute("aria-pressed", "true");
  await expect(rows).toHaveCount(5);
  const referenceIds = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-statement-id")));
  expect(referenceIds.filter((id) => id.includes("https://schema.org/object"))).toHaveLength(2);
  expect(referenceIds.filter((id) => id.includes("https://schema.org/result"))).toHaveLength(2);
  expect(referenceIds.filter((id) => id.includes("http://purl.org/dc/terms/conformsTo"))).toHaveLength(1);
  await interaction.getByRole("button", { name: "Source", exact: true }).click();
  await expect(interaction.getByRole("textbox", { name: /Editing interoperability\.metadata\.txt/ })).toHaveValue(/schema:potentialAction/);
  await interaction.getByRole("button", { name: "Table", exact: true }).click();
  await expect(rows).toHaveCount(5);
  await referencesFilter.click();
  await expect(rows).toHaveCount(unfilteredCount);
  await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).click();
  expect(pageErrors, `${url} produced no uncaught browser errors`).toEqual([]);
}

test("both editions independently filter CKS interfaces and qualified object references", async ({ browser }) => {
  for (const url of Object.values(editions)) {
    const page = await browser.newPage();
    await interoperabilityFilterJourney(page, url);
    await interoperabilityFilterJourney(page, url, true);
    await page.close();
  }
});

test("both editions filter only the KO-level license statement", async ({ browser }) => {
  for (const url of Object.values(editions)) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
    const panel = page.locator("details.metadataRigCard, details.metadata-rig-card").first();
    await panel.getByRole("button", { name: "Interact", exact: true }).click();
    const interaction = page.getByRole("dialog", { name: "DFU Severity Score KO", exact: true });
    await fileButton(interaction, "reusability.metadata.txt").click();
    const rows = rdfTable(interaction).locator("tbody > tr[data-statement-id]");
    const unfilteredCount = await rows.count();
    expect(unfilteredCount).toBeGreaterThan(1);
    await interaction.getByRole("button", { name: "Reusability Principles" }).click();
    const license = interaction.getByRole("button", { name: "License", exact: true });
    await expect(license).toHaveAttribute("aria-pressed", "false");
    await license.click();
    await expect(license).toHaveAttribute("aria-pressed", "true");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-statement-id", /https:\/\/schema\.org\/license/);
    await expect(rows.first()).toContainText("MIT");
    await interaction.getByRole("button", { name: "Source", exact: true }).click();
    await expect(interaction.getByRole("textbox", { name: /Editing reusability\.metadata\.txt/ })).toHaveValue(/schema:license/);
    await interaction.getByRole("button", { name: "Table", exact: true }).click();
    await expect(rows).toHaveCount(1);
    await license.click();
    await expect(license).toHaveAttribute("aria-pressed", "false");
    await expect(rows).toHaveCount(unfilteredCount);
    await page.close();
  }
});

test("both editions filter declared dependencies independently of license", async ({ browser }) => {
  for (const url of Object.values(editions)) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
    const panels = page.locator("details.metadataRigCard, details.metadata-rig-card");
    for (const [index, name, expectedDependencies] of [
      [0, "DFU Severity Score KO", 0],
      [2, "HBOT Regimen Burden KO", 2],
    ]) {
      await panels.nth(index).getByRole("button", { name: "Interact", exact: true }).click();
      const interaction = page.getByRole("dialog", { name, exact: true });
      await fileButton(interaction, "reusability.metadata.txt").click();
      const rows = rdfTable(interaction).locator("tbody > tr[data-statement-id]");
      const unfilteredCount = await rows.count();
      await interaction.getByRole("button", { name: "Reusability Principles" }).click();
      const license = interaction.getByRole("button", { name: "License", exact: true });
      const dependencies = interaction.getByRole("button", { name: "Dependencies", exact: true });
      await expect(dependencies).toHaveAttribute("aria-pressed", "false");
      await dependencies.click();
      await expect(dependencies).toHaveAttribute("aria-pressed", "true");
      await expect(license).toHaveAttribute("aria-pressed", "false");
      await expect(rows).toHaveCount(expectedDependencies);
      if (expectedDependencies) {
        const ids = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-statement-id")));
        expect(ids.every((id) => id.includes("https://schema.org/softwareRequirements"))).toBe(true);
        await expect(rdfTable(interaction)).toContainText("ajv ^8.17.1");
        await expect(rdfTable(interaction)).toContainText("ajv-formats ^3.0.1");
      }
      await license.click();
      await expect(dependencies).toHaveAttribute("aria-pressed", "true");
      await expect(license).toHaveAttribute("aria-pressed", "true");
      await expect(rows).toHaveCount(expectedDependencies + 1);
      await dependencies.click();
      await expect(rows).toHaveCount(1);
      await license.click();
      await expect(rows).toHaveCount(unfilteredCount);
      await interaction.getByRole("button", { name: "Close metadata interaction", exact: true }).click();
    }
    await page.close();
  }
});
