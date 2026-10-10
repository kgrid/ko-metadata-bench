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
  { control: "K exercise", panels: "details.knowledgeCard, details.knowledge-card" },
  { control: "F exercise", panels: "details.resultGroup, details.result-group" },
  { control: "A exercise", panels: "details.accessibilityCard, details.accessibility-card" },
  { control: "I exercise", panels: "details.interoperabilityPanel, details.interoperability-panel" },
  { control: "R exercise", panels: "details.reusabilityCard, details.reusability-card" },
];
const visibleText = async (locator) => (await locator.allTextContents()).map((value) => value.replace(/\s+/g, " ").trim());

async function rosters(page, expected) {
  const observed = {};
  for (const view of views) {
    await page.getByRole("button", { name: view.control, exact: true }).click();
    const panels = page.locator(view.panels);
    await expect(panels).toHaveCount(expected.length);
    const names = (await panels.locator("summary > strong").allTextContents()).map((name) => name.trim());
    expect(names, `${view.control} preserves the KO order`).toEqual(expected);
    if (view.control === "K exercise") {
      const knowledgeProjection = [];
      expect(await panels.evaluateAll((nodes) => nodes.every((node) => !node.open))).toBe(true);
      const counts = [[2, 2], [1, 1], [3, 3], [1, 1], [1, 0]].slice(0, expected.length);
      const linking = [
        "KO-only",
        "Element-linked",
        "Element-linked",
        "Convergent",
        "None",
      ];
      const levels = [2, 3, 3, 5, 1];
      const explanations = [
        "Evidence linked to the whole KO, not its elements.",
        "Evidence linked to an element and a CKS passage.",
        "Evidence linked across elements; code passages identified.",
        "Evidence, CKS, and code passages all linked by element.",
        "No evidence linked directly to this assembly.",
      ];
      for (const [index, [elements, sources]] of counts.entries()) {
        const panel = panels.nth(index);
        const linkingDetail = panel.locator("summary .knowledgeNexusLabel, summary .knowledge-nexus-label");
        await expect(linkingDetail).toHaveText(linking[index]);
        await expect(linkingDetail).toHaveAttribute("title", explanations[index]);
        await expect(linkingDetail).toHaveAttribute("tabindex", "0");
        await expect(linkingDetail).toHaveClass(new RegExp(`nexus(?:Level|[-]level[-])${levels[index]}`));
        await expect(panel.locator("summary .knowledgeTabIndicators, summary .knowledge-tab-indicators").locator(".knowledgeFacetCount, .knowledge-facet-count")).toHaveCount(1);
        await expect(panel.locator("summary .knowledgeCounts, summary .knowledge-counts")).toHaveCount(0);
        const facetCounter = panel.locator("summary .knowledgeFacetCount, summary .knowledge-facet-count");
        await expect(facetCounter).toHaveText("2 Facets");
        await expect(facetCounter).toHaveClass(index === 4 ? /incompleteFacets|incomplete-facets/ : /hasFacets|has-facets/);
        const labels = [`${elements} ${elements === 1 ? "element" : "elements"}`, `${sources} ${sources === 1 ? "source" : "sources"}`];
        if (index === 4) labels.push("4 KOs");
        await expect(panel.locator(".knowledgeFacetHeading > span, .knowledge-facet-heading > span")).toHaveText(labels);
        await expect(panel.locator(".knowledgeFacetRow, .knowledge-facet-row")).toHaveCount(labels.length);
        await expect(panel.locator(".knowledgeFacetRow .facetNumber, .knowledge-facet-row .facet-number")).toHaveText(labels.map((_, number) => String(number + 1)));
        await panel.locator("summary").click();
        expect(await visibleText(panel.locator(".knowledgeOpenButton"))).toEqual(Array(await panel.locator(".knowledgeOpenButton").count()).fill("Explore"));
        knowledgeProjection.push({
          name: expected[index],
          linking: await linkingDetail.textContent(),
          facetLabels: await visibleText(panel.locator(".knowledgeFacetHeading, .knowledge-facet-heading")),
          elementCards: await visibleText(panel.locator(".knowledgeElementCard, .knowledge-element-card")),
          evidenceGroups: await visibleText(panel.locator(".knowledgeEvidenceGroup, .knowledge-evidence-group")),
          koEvidence: await visibleText(panel.locator(".knowledgeKoEvidence, .knowledge-ko-evidence")),
          emptyEvidence: await visibleText(panel.locator(".knowledgeEmptyState, .knowledge-empty-state")),
        });
        await panel.locator("summary").click();
      }
      observed.knowledgeProjection = knowledgeProjection;
      const first = panels.first();
      await first.locator("summary").click();
      await expect(first.locator(".knowledgeElementCard, .knowledge-element-card")).toHaveCount(2);
      await expect(first.locator(".knowledgeEvidenceGroup, .knowledge-evidence-group")).toHaveCount(0);
      await expect(first.locator(".knowledgeKoEvidence, .knowledge-ko-evidence")).toContainText("Evidence for this KO");
      await expect(first.locator(".knowledgeKoEvidence, .knowledge-ko-evidence")).toContainText("2 sources");
      await expect(first.locator(".knowledgeKoEvidence .knowledgeEvidenceItem, .knowledge-ko-evidence .knowledge-evidence-item")).toHaveCount(0);
      await first.getByRole("button", { name: "Explore evidence for this KO" }).click();
      const koEvidenceDetail = page.getByRole("dialog", { name: "Evidence for this KO" });
      await expect(koEvidenceDetail.locator(".knowledgeDetailSource")).toHaveCount(2);
      await expect(koEvidenceDetail.getByRole("heading", { name: "Whole Knowledge Object" })).toBeVisible();
      await expect(koEvidenceDetail.getByRole("heading", { name: "Knowledge element" })).toHaveCount(0);
      await expect(koEvidenceDetail.getByRole("link", { name: "Open evidence source ↗" }).first()).toHaveAttribute("href", /^https:\/\/doi\.org\//);
      await koEvidenceDetail.getByRole("button", { name: "Close KO evidence" }).click();
      await first.locator(".knowledgeElementCard, .knowledge-element-card").first().getByRole("button", { name: "Explore Wagner Questionnaire Logic" }).click();
      const firstDetail = page.getByRole("dialog", { name: "Wagner Questionnaire Logic" });
      await expect(firstDetail).toContainText("No evidential basis declared for this knowledge element.");
      await expect(firstDetail).toContainText("Declared for the whole KO, not connected to this element.");
      await expect(firstDetail.locator(".knowledgeDetailSource")).toHaveCount(0);
      await firstDetail.getByRole("button", { name: "Explore evidence for this KO" }).click();
      await expect(page.getByRole("dialog", { name: "Evidence for this KO" }).locator(".knowledgeDetailSource")).toHaveCount(2);
      await page.getByRole("button", { name: "Close KO evidence" }).click();
      const second = panels.nth(1);
      await second.locator("summary").click();
      await expect(second.locator(".knowledgeElementCard, .knowledge-element-card")).toHaveCount(1);
      await expect(second.locator(".knowledgeEvidenceGroup, .knowledge-evidence-group")).toContainText("1 source");
      await expect(second.locator(".knowledgeEvidenceGroup .knowledgeEvidenceItem, .knowledge-evidence-group .knowledge-evidence-item")).toHaveCount(0);
      await expect(second.locator(".knowledgeEvidenceGroup h3, .knowledge-evidence-group h3")).toHaveText("Evidence for DFU HBO2 Decision Logic");
      await expect(second.locator(".knowledgeKoEvidence, .knowledge-ko-evidence")).toHaveCount(0);
      await second.getByRole("button", { name: "Explore DFU HBO2 Decision Logic" }).click();
      const knowledgeDetail = page.getByRole("dialog", { name: "DFU HBO2 Decision Logic" });
      await expect(knowledgeDetail).toBeVisible();
      await expect(knowledgeDetail.getByRole("heading", { name: "Evidence", exact: true })).toBeVisible();
      await expect(knowledgeDetail.getByRole("heading", { name: "Knowledge element", exact: true })).toBeVisible();
      await expect(knowledgeDetail.getByRole("heading", { name: "Specification passage" })).toBeVisible();
      await expect(knowledgeDetail.getByRole("heading", { name: "Implementation passage" })).toHaveCount(0);
      await expect(knowledgeDetail.getByRole("heading", { name: "Evidence for this KO" })).toHaveCount(0);
      await expect(knowledgeDetail.getByRole("link", { name: "Open evidence source ↗" })).toHaveAttribute("href", "https://uhms.org/images/CPG/UHM_42-3_CPG_for_DFU.pdf");
      await knowledgeDetail.getByRole("button", { name: "Follow passage" }).click();
      const preciseCks = page.locator(".documentViewerDialog, .document-viewer-dialog");
      await expect(preciseCks.getByRole("status")).toContainText("Showing highlighted passage");
      await expect(preciseCks.locator("mark.knowledgePassageHighlight").first()).toBeVisible();
      await preciseCks.getByRole("button", { name: "Close document" }).click();
      await knowledgeDetail.getByRole("button", { name: "View Implementation" }).click();
      const implementation = page.locator(".knowledgeImplementationDialog");
      await expect(implementation).toContainText("Read-only · Embedded in this knowledge object");
      await expect(implementation.locator("pre code")).not.toBeEmpty();
      await implementation.getByRole("button", { name: "Close implementation" }).click();
      await expect(knowledgeDetail).toBeVisible();
      await knowledgeDetail.getByRole("button", { name: "View Specification" }).click();
      await expect(page.locator(".documentViewerDialog, .document-viewer-dialog")).toBeVisible();
      await page.getByRole("button", { name: "Close document" }).click();
      await page.getByRole("button", { name: "Close knowledge and evidence" }).click();
      await expect(panels.nth(2).locator(".knowledgeEvidenceGroup h3, .knowledge-evidence-group h3")).toHaveText([
        "Evidence for Regimen Range",
        "Evidence for Burden Questionnaire Logic",
      ]);
      await expect(panels.nth(2).locator(".knowledgeEvidenceGroup, .knowledge-evidence-group").first()).toContainText("2 sources");
      await expect(panels.nth(2).locator(".knowledgeEvidenceGroup, .knowledge-evidence-group").last()).toContainText("1 source");
      await panels.nth(2).locator("summary").click();
      await panels.nth(2).getByRole("button", { name: "Explore Burden Response Analysis" }).click();
      const burdenDetail = page.getByRole("dialog", { name: "Burden Response Analysis" });
      await expect(burdenDetail).toContainText("No evidential basis declared for this knowledge element.");
      await expect(burdenDetail.getByRole("heading", { name: "Implementation passage" })).toBeVisible();
      await expect(burdenDetail.getByRole("heading", { name: "Specification passage" })).toHaveCount(0);
      await burdenDetail.getByRole("button", { name: "Follow passage" }).click();
      const preciseCode = page.locator(".knowledgeImplementationDialog");
      await expect(preciseCode.getByRole("status")).toContainText("Showing highlighted passage");
      await expect(preciseCode.locator("mark.knowledgePassageHighlight").first()).toBeVisible();
      await preciseCode.getByRole("button", { name: "Close implementation" }).click();
      await burdenDetail.getByRole("button", { name: "Close knowledge and evidence" }).click();
      await expect(panels.nth(3).locator(".knowledgeEvidenceGroup h3, .knowledge-evidence-group h3")).toHaveText("Evidence for Margolis DFU Prognostic Lookup");
      await panels.nth(3).locator("summary").click();
      await panels.nth(3).getByRole("button", { name: "Explore Margolis DFU Prognostic Lookup" }).click();
      const margolisDetail = page.getByRole("dialog", { name: "Margolis DFU Prognostic Lookup" });
      await expect(margolisDetail.getByRole("heading", { name: "Specification passage" })).toBeVisible();
      await expect(margolisDetail.getByRole("heading", { name: "Implementation passage" })).toBeVisible();
      await expect(margolisDetail.locator(".knowledgeDetailBody .knowledgeDetailSource")).toHaveCount(4);
      await expect(margolisDetail.getByRole("link", { name: "Open evidence source ↗" })).toHaveAttribute("href", "https://pmc.ncbi.nlm.nih.gov/articles/instance/9246994/bin/NIHMS1801579-supplement-1.pdf");
      await margolisDetail.getByRole("button", { name: "Follow passage" }).first().click();
      await expect(page.locator(".documentViewerDialog, .document-viewer-dialog").getByRole("status")).toContainText("Showing highlighted passage");
      await page.getByRole("button", { name: "Close document" }).click();
      await margolisDetail.getByRole("button", { name: "Follow passage" }).nth(1).click();
      await expect(page.locator(".knowledgeImplementationDialog").getByRole("status")).toContainText("Showing highlighted passage");
      await page.getByRole("button", { name: "Close implementation" }).click();
      await margolisDetail.getByRole("button", { name: "Close knowledge and evidence" }).click();
      if (expected.length === 5) {
        const ka = panels.last();
        await ka.locator("summary").click();
        await expect(ka.locator(".knowledgeElementCard, .knowledge-element-card")).toHaveCount(1);
        await expect(ka.locator(".knowledgeFacetContent, .knowledge-facet-content").nth(1)).toContainText("No evidential basis declared anywhere in this KO.");
        await ka.getByRole("button", { name: "Explore HBOT Treatment Target KA Orchestration Logic" }).click();
        const kaDetail = page.getByRole("dialog", { name: /.+/ });
        await expect(kaDetail).toContainText("No evidential basis declared for this knowledge element.");
        await expect(kaDetail).toContainText("No evidential basis declared anywhere in this KO.");
        await expect(kaDetail).toContainText("Constituent KO evidence is not inherited.");
        await kaDetail.getByRole("button", { name: "Close knowledge and evidence" }).click();
      }
    }
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

test("both editions keep the K-view learning path usable at narrow width", async ({ browser }) => {
  const readings = [];
  for (const url of Object.values(editions)) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "K exercise", exact: true }).click();
    const panels = page.locator("details.knowledgeCard, details.knowledge-card");
    await expect(panels).toHaveCount(4);
    await panels.nth(2).locator("summary").click();
    await panels.nth(2).locator(".knowledgeElementCard, .knowledge-element-card").first().getByRole("button", { name: "Explore Regimen Range" }).click();
    const detail = page.getByRole("dialog", { name: "Regimen Range" });
    await expect(detail).toBeVisible();
    const geometry = await detail.evaluate((node) => {
      const dialog = node.getBoundingClientRect();
      const body = node.querySelector(".knowledgeDetailBody").getBoundingClientRect();
      return { dialogLeft: dialog.left, dialogRight: dialog.right, bodyLeft: body.left, bodyRight: body.right, viewportWidth: innerWidth };
    });
    expect(geometry.dialogLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.dialogRight).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.bodyLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.bodyRight).toBeLessThanOrEqual(geometry.viewportWidth);
    await expect(detail.getByRole("button", { name: "View Specification" })).toBeVisible();
    await expect(detail.getByRole("button", { name: "View Implementation" }).first()).toBeVisible();
    readings.push(await visibleText(detail.locator(".knowledgeDetailBody")));
    await detail.getByRole("button", { name: "Close knowledge and evidence" }).click();
    await expect(panels.nth(2)).toBeVisible();
    await page.close();
  }
  expect(readings[1]).toEqual(readings[0]);
});
