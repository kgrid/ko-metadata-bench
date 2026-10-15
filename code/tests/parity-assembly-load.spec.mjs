import { readServerSourceSync } from "./server-source.mjs";
import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};
const source = readServerSourceSync();
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
      const counts = [[2, 2], [1, 1], [3, 3], [1, 1], [1, 0]].slice(0, expected.length);
      const linking = ["KO-only", "Element-linked", "Element-linked", "Convergent", "None"];
      for (const [index, [elements, sources]] of counts.entries()) {
        const panel = panels.nth(index);
        await expect(panel.locator("summary .knowledgeNexusLabel, summary .knowledge-nexus-label")).toHaveText(linking[index]);
        await expect(panel.locator("summary .knowledgeFacetCount, summary .knowledge-facet-count")).toHaveText("2 Facets");
        const labels = [`${elements} ${elements === 1 ? "element" : "elements"}`, `${sources} ${sources === 1 ? "source" : "sources"}`];
        if (index === 4) labels.push("4 KOs");
        await expect(panel.locator(".knowledgeFacetHeading > span, .knowledge-facet-heading > span")).toHaveText(labels);
        await expect(panel.locator(".knowledgeFacetRow, .knowledge-facet-row")).toHaveCount(labels.length);
        await expect(panel.locator(".knowledgeFacetRow .facetNumber, .knowledge-facet-row .facet-number")).toHaveText(labels.map((_, number) => String(number + 1)));
        await expect(panel.locator("summary .knowledgeOpenButton")).toHaveCount(1);
        await expect(panel.locator(".knowledgeCardBody .knowledgeOpenButton, .knowledge-card-body .knowledgeOpenButton")).toHaveCount(0);
        await panel.locator("summary .knowledgeOpenButton").click();
        await expect(panel).not.toHaveAttribute("open", "");
        const graph = page.getByRole("dialog", { name: expected[index], exact: true });
        await expect(graph).toBeVisible();
        await expect(graph.getByRole("region", { name: "Evidence-linking graph" })).toBeVisible();
        await expect(graph.locator(".knowledgeGraphLane")).toHaveCount(elements + 1);
        const pulsing = graph.locator(".knowledgeGraphNode.knowledgeGraphCategoryPulse");
        await expect(pulsing).toHaveCount([3, 4, 7, 6, 0][index]);
        await expect(graph.locator(".knowledgeGraphLane.knowledgeGraphConvergentLane")).toHaveCount(index === 3 ? 1 : 0);
        await expect(graph.locator(".knowledgeSubgraphHeader .knowledgeNexusLabel, .knowledgeSubgraphHeader .knowledge-nexus-label")).toHaveText(linking[index]);
        await expect(graph.locator(".knowledgeGraphAnnotation.knowledgeGraphCategoryPulse")).toHaveCount(0);
        if (index === 2) await expect(graph.locator(".knowledgeGraphLane").last().locator(".knowledgeGraphCategoryPulse")).toHaveCount(0);
        if (index === 3) await expect(pulsing.first()).toHaveCSS("animation-name", "knowledgeGraphConvergentPulse");
        const relationshipList = graph.locator(".knowledgeGraphRelationshipList");
        await expect(relationshipList.getByText(`Declared relationships (${await graph.locator(".knowledgeGraphEdge").count()})`)).toBeVisible();
        await relationshipList.locator("summary").click();
        await expect(relationshipList.locator("li button")).toHaveCount(await graph.locator(".knowledgeGraphEdge").count());
        if (index === 4) {
          await expect(graph.locator(".knowledgeGraphAbsence")).not.toHaveCount(0);
          await expect(graph.locator(".knowledgeGraphAbsence")).toHaveText(Array((elements + 1) * 3).fill("Not declared"));
          await expect(graph.locator(".knowledgeGraphLane.isEmpty")).toHaveCount(elements + 1);
          await expect(relationshipList).toContainText("None declared.");
        }
        await expect(graph.locator(".knowledgePassageGlimpse mark")).toHaveCount([0, 1, 3, 3, 0][index]);
        await expect(graph.locator(".knowledgeGraphEvidence .knowledgePassageGlimpse")).toHaveCount(0);
        if (index === 0) {
          await expect(graph.locator(".knowledgeGraphLane").first().locator(".knowledgeGraphBranch")).toHaveCount(2);
          await expect(graph.locator(".knowledgeGraphLane").nth(1).locator(".knowledgeGraphEvidence .knowledgeGraphAbsence")).toContainText("Not declared");
        }
        if (index === 1) {
          await expect(graph.locator(".knowledgeGraphNode").filter({ hasText: "specification passage" })).toHaveCount(1);
          await expect(graph.locator(".knowledgeGraphNode").filter({ hasText: "implementation passage" })).toHaveCount(0);
        }
        if (index === 2) {
          await expect(graph.locator(".knowledgeGraphLane").last().locator(".knowledgeGraphEvidence .knowledgeGraphAbsence")).toContainText("Not declared");
          await expect(graph.locator(".knowledgeGraphLane").last().locator(".knowledgeGraphImplementation .knowledgeGraphNode").filter({ hasText: "implementation passage" })).toHaveCount(1);
        }
        if (index === 3) {
          await expect(graph.locator(".knowledgeGraphPart")).toHaveCount(1);
          await expect(graph.locator(".knowledgeGraphNode").filter({ hasText: "specification passage" })).toHaveCount(1);
          await expect(graph.locator(".knowledgeGraphNode").filter({ hasText: "implementation passage" })).toHaveCount(2);
          await expect(graph.locator(".knowledgeGraphRoute").filter({ hasText: "annotation-margolis-table3" })).toHaveCount(0);
          const annotation = graph.locator(".knowledgeGraphAnnotation").first();
          await expect(annotation).toContainText("Annotation ·");
          await annotation.click();
          await expect(graph.getByRole("complementary", { name: "Evidence graph inspector" })).toContainText("Annotation");
          await graph.getByRole("button", { name: "Close evidence graph inspector" }).click();
          const tableNode = graph.locator(".knowledgeGraphEvidence").getByRole("button", { name: "Inspect evidence resource: Supplementary Table 3" });
          await tableNode.click();
          const inspector = graph.getByRole("complementary", { name: "Evidence graph inspector" });
          await expect(inspector).toContainText("annotation-margolis-table3");
          await expect(inspector.getByRole("link", { name: "Open evidence source" })).toHaveAttribute("href", /NIHMS1801579-supplement-1\.pdf$/);
          await expect(graph.getByRole("link", { name: "Open source: Supplementary Table 3" })).toHaveAttribute("href", /NIHMS1801579-supplement-1\.pdf$/);
          await graph.getByRole("button", { name: "Close evidence graph inspector" }).click();
          const passage = graph.locator(".knowledgeGraphNode").filter({ hasText: "implementation passage" }).first();
          await passage.click();
          await expect(inspector).toContainText("src/prognosis.js");
          await expect(inspector).toContainText("Exact passage");
          await inspector.getByRole("button", { name: "Follow passage" }).click();
          const codeViewer = page.locator(".knowledgeImplementationDialog");
          await expect(codeViewer).toBeVisible();
          await expect(codeViewer.locator("mark.knowledgePassageHighlight")).not.toHaveCount(0);
          await codeViewer.getByRole("button", { name: "Close implementation" }).click();
          await expect(graph).toBeVisible();
          await graph.getByRole("button", { name: "Close evidence graph inspector" }).click();
          await graph.getByRole("button", { name: /^View passage:/ }).first().click();
          const directViewer = page.locator(".documentViewerDialog, .document-viewer-dialog, .knowledgeImplementationDialog");
          await expect(directViewer).toBeVisible();
          await expect(directViewer.locator("mark.knowledgePassageHighlight")).not.toHaveCount(0);
          await page.getByRole("button", { name: /Close (document|implementation)/ }).click();
          await expect(graph).toBeVisible();
          await graph.getByRole("button", { name: "Inspect relationship: koio:hasEvidentialBasis" }).first().click();
          await expect(inspector).toContainText("Subject");
          await expect(inspector).toContainText("Predicate");
          await expect(inspector).toContainText("Object");
          await graph.getByRole("button", { name: "Close evidence graph inspector" }).click();
          await graph.locator(".knowledgeGraphNode").filter({ hasText: "knowledge element" }).first().click();
          await inspector.getByRole("button", { name: "View Specification" }).click();
          await expect(page.locator(".documentViewerDialog, .document-viewer-dialog")).toBeVisible();
          await page.getByRole("button", { name: "Close document" }).click();
          await expect(graph).toBeVisible();
          await inspector.getByRole("button", { name: "View Implementation" }).click();
          await expect(page.locator(".knowledgeImplementationDialog")).toBeVisible();
          await page.getByRole("button", { name: "Close implementation" }).click();
          await graph.getByRole("button", { name: "Close evidence graph inspector" }).click();
          await graph.getByRole("button", { name: /Inspect evidence resource:.*Supplementary Table 3/ }).first().click();
          await expect(inspector.getByRole("link", { name: "Open evidence source" })).toHaveAttribute("href", /NIHMS1801579-supplement-1\.pdf$/);
          await graph.getByRole("button", { name: "Close evidence graph inspector" }).click();
        }
        if (index === 4) await expect(graph).toContainText("Constituent KO evidence is not inherited.");
        knowledgeProjection.push({
          name: expected[index],
          linking: await panel.locator("summary .knowledgeNexusLabel, summary .knowledge-nexus-label").textContent(),
          facetLabels: await visibleText(panel.locator(".knowledgeFacetHeading, .knowledge-facet-heading")),
          graph: await visibleText(graph.locator(".knowledgeSubgraphBody")),
        });
        await graph.getByRole("button", { name: "Close evidence subgraph" }).click();
        await panel.locator("summary").click();
        await expect(panel.locator(".knowledgeElementCard, .knowledge-element-card")).toHaveCount(elements);
        if (index === 4) await expect(panel.locator(".knowledgeEmptyState, .knowledge-empty-state")).toContainText("No evidential basis declared anywhere in this KO.");
      }
      observed.knowledgeProjection = knowledgeProjection;
    }
    observed[view.control] = names;
  }
  return observed;
}

async function journey(page, url) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:3100\/)/, (route) => route.abort());
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

test("both editions keep the KO-scoped K graph usable at narrow width", async ({ browser }) => {
  const readings = [];
  for (const url of Object.values(editions)) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1:3100\/)/, (route) => route.abort());
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "K exercise", exact: true }).click();
    const panels = page.locator("details.knowledgeCard, details.knowledge-card");
    await expect(panels).toHaveCount(4);
    await panels.nth(2).locator("summary .knowledgeOpenButton").click();
    const detail = page.getByRole("dialog", { name: koNames[2], exact: true });
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
    await expect(detail.locator(".knowledgeGraphLane")).toHaveCount(4);
    const laneColumns = await detail.locator(".knowledgeGraphLane").first().evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(laneColumns).toBe(1);
    const stackedOrder = await detail.locator(".knowledgeGraphLane").first().evaluate((node) => [...node.children].slice(0, 4).map((child) => child.className));
    expect(stackedOrder).toEqual(["knowledgeGraphEvidence", "knowledgeGraphSubject", "knowledgeGraphSpecification", "knowledgeGraphImplementation"]);
    const directPassage = detail.getByRole("button", { name: /^View passage:/ }).first();
    await directPassage.focus();
    await expect(directPassage).toBeFocused();
    expect(await directPassage.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40);
    await page.keyboard.press("Enter");
    await expect(page.locator(".knowledgeImplementationDialog mark.knowledgePassageHighlight")).toBeVisible();
    await page.getByRole("button", { name: "Close implementation" }).click();
    await expect(directPassage).toBeFocused();
    const relationships = detail.locator(".knowledgeGraphRelationshipList");
    await relationships.locator("summary").focus();
    await page.keyboard.press("Enter");
    const firstRelationship = relationships.getByRole("button").first();
    await firstRelationship.focus();
    await page.keyboard.press("Enter");
    await expect(detail.getByRole("complementary", { name: "Evidence graph inspector" })).toBeVisible();
    await expect(firstRelationship).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(firstRelationship).toBeFocused();
    await expect(detail.getByRole("complementary", { name: "Evidence graph inspector" })).toHaveCount(0);
    const touchNode = detail.locator(".knowledgeGraphSubject .knowledgeGraphNode").first();
    await touchNode.scrollIntoViewIfNeeded();
    const touchBox = await touchNode.boundingBox();
    await page.touchscreen.tap(touchBox.x + touchBox.width / 2, touchBox.y + touchBox.height / 2);
    await expect(detail.getByRole("complementary", { name: "Evidence graph inspector" })).toBeVisible();
    readings.push(await visibleText(detail.locator(".knowledgeSubgraphBody")));
    await detail.getByRole("button", { name: "Close evidence subgraph" }).click();
    await expect(panels.nth(2)).toBeVisible();
    await page.close();
  }
  expect(readings[1]).toEqual(readings[0]);
});
