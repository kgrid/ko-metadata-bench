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
