import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};

const objectNames = [
  "DFU Severity Score KO",
  "HBOT Treatment Decision KO",
  "HBOT Regimen Burden KO",
  "DFU Prognostic Indicator KO",
];

async function visibleObjectRoster(page) {
  return Object.fromEntries(await Promise.all(objectNames.map(async (name) => [
    name,
    await page.getByText(name, { exact: true }).first().isVisible(),
  ])));
}

async function viewState(page, heading, activeControl, sharedControl) {
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(page.getByText("HBOT Treatment Target Knowledge Assembly", { exact: true })).toHaveCount(0);
  const active = page.getByRole("button", { name: activeControl, exact: true });
  await expect(active).toHaveAttribute("aria-pressed", "true");
  return {
    heading,
    activeControl,
    activePressed: await active.getAttribute("aria-pressed"),
    objects: await visibleObjectRoster(page),
    sharedControlCount: sharedControl
      ? await page.getByRole("button", { name: sharedControl }).count()
      : null,
  };
}

async function navigateAndRecord(page, url) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("FAIR Knowledge Object Bench");

  const states = {};
  states.knowledgeObjects = await viewState(
    page,
    "Knowledge Objects",
    "Knowledge Objects",
    /^Open .+ overview$/,
  );

  await page.getByRole("button", { name: "Metadata Rig", exact: true }).click();
  states.metadata = await viewState(page, "Metadata", "Metadata Rig", "Interact");

  for (const exercise of [
    { key: "knowledge", control: "K exercise", heading: "Knowledge" },
    { key: "findability", control: "F exercise", heading: "Findability", shared: "Audit" },
    { key: "accessibility", control: "A exercise", heading: "Access" },
    { key: "interoperability", control: "I exercise", heading: "Interoperability", shared: "Stages" },
    { key: "reusability", control: "R exercise", heading: "Reusability" },
  ]) {
    await page.getByRole("button", { name: exercise.control, exact: true }).click();
    states[exercise.key] = await viewState(page, exercise.heading, exercise.control, exercise.shared);
  }

  await page.getByRole("button", { name: "Knowledge Objects", exact: true }).click();
  states.returnedKnowledgeObjects = await viewState(
    page,
    "Knowledge Objects",
    "Knowledge Objects",
    /^Open .+ overview$/,
  );
  expect(pageErrors, `${url} produced no uncaught browser errors`).toEqual([]);
  return states;
}

test("server and standalone editions have identical startup and principal-view navigation", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  const server = await navigateAndRecord(serverPage, editions.server);
  const standalone = await navigateAndRecord(standalonePage, editions.standalone);

  for (const [view, state] of Object.entries(server)) {
    expect.soft(Object.values(state.objects), `server ${view} retains all four KO projections`).toEqual([true, true, true, true]);
  }
  for (const [view, state] of Object.entries(standalone)) {
    expect.soft(Object.values(state.objects), `standalone ${view} retains all four KO projections`).toEqual([true, true, true, true]);
  }
  expect(standalone).toEqual(server);

  await serverPage.close();
  await standalonePage.close();
});

test("both editions keep one interoperability boundary diagram across the four stages", async ({ browser }) => {
  const progressByStage = [
    ["See supplied example input and response values.", "What the values mean, what complete objects are valid, and how to invoke the KO."],
    ["Use supplied meanings to interpret the example input and response values.", "What complete objects are valid and how to invoke the KO."],
    ["Use supplied meanings and profiles to prepare or check complete input and output objects.", "How those objects bind to an invocation, including success and failure."],
    ["Use supplied descriptions to interpret objects and follow an invocation and response contract.", "Whether real systems can follow that agreement successfully."],
  ];
  const editionReadings = [];
  for (const [edition, url] of Object.entries(editions)) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 820 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "I exercise", exact: true }).click();
    await page.getByRole("button", { name: "Stages", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "DFU Severity Score KO", exact: true });
    await expect(dialog).toBeVisible();
    const controls = dialog.getByRole("group", { name: "Choose interoperability simulation stage" }).getByRole("button");
    await expect(controls).toHaveCount(4);
    const diagram = dialog.locator(".stageBoundaryDiagram, .stage-boundary-diagram");
    await expect(diagram).toBeVisible();
    await expect(dialog.locator(".interoperabilityStageSources, .interoperability-stage-sources")).toHaveCount(0);
    const systems = diagram.locator(".stageBoundarySystem, .stage-boundary-system");
    await expect(systems).toHaveCount(2);
    await expect(systems.locator("strong")).toHaveText(["Requesting system", "System hosting the KO"]);
    await expect(systems.last().locator(".stageBoundaryContainedKo, .stage-boundary-contained-ko")).toHaveText("KO");
    await expect(diagram.getByLabel("Input request to the system hosting the KO")).toContainText("Input / request");
    await expect(diagram.getByLabel("Output response to the requesting system")).toContainText("Output / response");
    await expect(diagram.getByRole("group", { name: "Descriptions of the system-to-system exchange" })).toBeVisible();
    const progress = dialog.getByRole("region", { name: "What this stage reveals to the requesting system" });
    await expect(progress).toBeVisible();
    const firstBox = await diagram.boundingBox();
    const readings = [];
    for (const [stage, counts] of [[0, [0, 0, 0]], [1, [1, 0, 0]], [2, [1, 1, 0]], [3, [1, 1, 1]]]) {
      await controls.nth(stage).click();
      await expect(diagram).toHaveAttribute("data-stage", String(stage));
      await expect(controls.nth(stage)).toHaveAttribute("aria-pressed", "true");
      await expect(progress.locator("p strong")).toHaveText(["Can now", "Still unknown"]);
      await expect(progress.locator("p span")).toHaveText(progressByStage[stage]);
      await expect(dialog.locator(".simulationTag, .simulation-tag")).toHaveText("Fixture replay · KO not invoked");
      const overview = dialog.locator(".stageExampleOverview, .stage-example-overview");
      const exampleDetail = dialog.locator(".stageExampleDetail, .stage-example-detail");
      if (stage <= 1) {
        await expect(overview).toBeVisible();
        await expect(overview.locator("span")).toHaveText(["10 responses", "output1: 2"]);
        await expect(exampleDetail).not.toHaveAttribute("open", "");
        await exampleDetail.locator("summary").click();
        await expect(exampleDetail.locator(".executionIo, .execution-io")).toBeVisible();
        await exampleDetail.locator("summary").click();
      } else {
        await expect(overview).toHaveCount(0);
        await expect(exampleDetail).toHaveCount(0);
      }
      if (stage === 2) await expect(dialog).toContainText("The output fixture changes from a raw value to a structured result");
      for (const [index, name] of ["Semantics", "Data object profiles", "Interface"].entries()) {
        await expect(diagram.locator(`[aria-label="${name}: revealed"]`), `${edition} stage ${stage} ${name}`).toHaveCount(counts[index]);
      }
      for (const [index, name] of ["Semantics", "Data object profiles", "Interface"].entries()) {
        await expect(diagram.locator(`[aria-label="${name}: withheld"]`), `${edition} stage ${stage} withheld ${name}`).toHaveCount(1 - counts[index]);
      }
      const box = await diagram.boundingBox();
      expect(Math.abs(box.x - firstBox.x), `${edition} stage ${stage} keeps the diagram aligned`).toBeLessThan(2);
      readings.push(await progress.locator("p span").allTextContents());
    }
    editionReadings.push(readings);
    for (const stage of [1, 3, 0, 2]) {
      await controls.nth(stage).click();
      await expect(diagram).toHaveAttribute("data-stage", String(stage));
      await expect(controls.nth(stage)).toHaveAttribute("aria-pressed", "true");
      await expect(progress.locator("p span")).toHaveText(progressByStage[stage]);
      await expect(diagram.locator('[aria-label="Interface: revealed"]')).toHaveCount(stage === 3 ? 1 : 0);
    }
    await page.setViewportSize({ width: 390, height: 820 });
    for (const stage of [0, 1, 2, 3]) {
      await controls.nth(stage).click();
      await expect(diagram).toHaveAttribute("data-stage", String(stage));
      await expect(progress.locator("p span")).toHaveText(progressByStage[stage]);
      for (const [label, element] of [["diagram", diagram], ["progress", progress], ["stage controls", controls.first()]]) {
        const box = await element.boundingBox();
        expect(box, `${edition} narrow stage ${stage} ${label} has a box`).not.toBeNull();
        expect(box.x, `${edition} narrow stage ${stage} ${label} left edge`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${edition} narrow stage ${stage} ${label} right edge`).toBeLessThanOrEqual(390);
      }
    }
    await page.close();
  }
  expect(editionReadings[0]).toEqual(editionReadings[1]);
});
