import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};
const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const assembly = JSON.parse(source.match(/^const EMBEDDED_ASSEMBLY: EmbeddedAssembly \| null = (\{.*\});/m)?.[1] ?? "null");
const koNames = JSON.parse(source.match(/^const OBJECT_DISPLAY_NAMES = (\[[^\n]+\]) as const;/m)?.[1] ?? "null");
const assemblyName = assembly.generalView.displayName;
const views = [
  { control: "Knowledge Objects", panels: "details.koObjectShade, details.ko-object-shade" },
  { control: "Metadata Rig", panels: "details.metadataRigCard, details.metadata-rig-card" },
  { control: "F exercise", panels: "details.resultGroup, details.result-group" },
  { control: "A exercise", panels: "details.accessibilityCard, details.accessibility-card" },
  { control: "I exercise", panels: "details.interoperabilityPanel, details.interoperability-panel" },
  { control: "R exercise", panels: "details.reusabilityCard, details.reusability-card" },
];

async function rosters(page, expected) {
  const observed = {};
  for (const view of views) {
    await page.getByRole("button", { name: view.control, exact: true }).click();
    const panels = page.locator(view.panels);
    await expect(panels).toHaveCount(expected.length);
    const names = (await panels.locator("summary > strong").allTextContents()).map((name) => name.trim());
    expect(names, `${view.control} preserves the KO order`).toEqual(expected);
    observed[view.control] = names;
  }
  return observed;
}

async function journey(page, url) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const before = await rosters(page, koNames);

  await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
  const load = page.getByRole("button", { name: "Load as Knowledge Object", exact: true });
  await expect(load).toBeEnabled();
  await load.click();
  await expect(page.getByRole("status")).toHaveText("Loaded as a Knowledge Object");
  await expect(load).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Orchestration", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Orchestration", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Orchestration" })).toBeVisible();
  await page.getByRole("button", { name: "Close orchestration", exact: true }).click();

  const after = await rosters(page, [...koNames, assemblyName]);
  await page.getByRole("button", { name: "F exercise", exact: true }).click();
  const kaFindabilityPanel = page.locator("details.resultGroup, details.result-group").last();
  const auditButton = kaFindabilityPanel.getByRole("button", { name: "Audit", exact: true });
  await expect(auditButton).toBeEnabled();
  await auditButton.click();
  const audit = page.getByRole("dialog", { name: assemblyName, exact: true });
  await expect(audit).toBeVisible();
  const auditRows = audit.locator("tbody tr:not(.auditTableSectionGap):not(.audit-table-section-gap)");
  await expect(auditRows).toHaveCount(16);
  expect(await auditRows.locator("td:nth-child(2)").allTextContents()).toEqual(Array(16).fill("Yes"));
  await expect(audit.locator(".auditTableSectionGap, .audit-table-section-gap")).toHaveCount(0);
  const auditResults = await auditRows.locator("td:nth-child(3)").allTextContents();
  expect(auditResults).toContain("Found");
  await expect(auditRows.first().locator("td:last-child")).toContainText("this assembly");
  await audit.getByRole("button", { name: "Close findability audit", exact: true }).click();
  await page.getByRole("button", { name: "Knowledge Objects", exact: true }).click();
  const unavailableRun = page.getByRole("button", { name: `${assemblyName} Runner unavailable`, exact: true });
  await expect(unavailableRun).toBeDisabled();
  for (const kind of ["overview", "logic"]) {
    await page.getByRole("button", { name: `Open ${assemblyName} ${kind}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: assemblyName, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("img")).toHaveAttribute("src", /^data:image\/webp;base64,/);
    await dialog.getByRole("button", { name: `Close knowledge object ${kind}`, exact: true }).click();
  }
  await page.getByRole("button", { name: `Open ${assemblyName} files`, exact: true }).click();
  const files = page.getByRole("dialog", { name: assemblyName, exact: true });
  await expect(files).toBeVisible();
  await files.getByRole("button", { name: "Close knowledge object files", exact: true }).click();

  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  const metadataPanel = page.locator("details.metadataRigCard, details.metadata-rig-card").last();
  await metadataPanel.getByRole("button", { name: "Interact", exact: true }).click();
  const metadata = page.getByRole("dialog", { name: assemblyName, exact: true });
  await expect(metadata).toBeVisible();
  for (const name of Object.keys(assembly.generalView.metadataPaths)) {
    await expect(metadata.getByText(name, { exact: true }).first()).toBeVisible();
  }
  await metadata.getByRole("button", { name: "Close metadata interaction", exact: true }).click();

  // A second load is impossible, and revisiting the KA does not append a sixth panel.
  await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Loaded as a Knowledge Object");
  await expect(page.getByRole("button", { name: "Load as Knowledge Object", exact: true })).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  const reset = await rosters(page, koNames);
  await page.getByRole("button", { name: "Knowledge Assembly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Load as Knowledge Object", exact: true })).toBeEnabled();
  expect(errors, `${url} produced no uncaught browser errors`).toEqual([]);
  return { before, after, reset, auditResults, assemblyName, metadataFiles: Object.keys(assembly.generalView.metadataPaths) };
}

test("both editions keep four KOs before load, project the KA fifth, and reset on reload", async ({ browser }) => {
  test.setTimeout(90_000);
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  const server = await journey(serverPage, editions.server);
  const standalone = await journey(standalonePage, editions.standalone);
  expect(standalone).toEqual(server);
  await serverPage.close();
  await standalonePage.close();
});
