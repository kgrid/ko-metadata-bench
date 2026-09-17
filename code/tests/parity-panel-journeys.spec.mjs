import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};

const objectName = "Wagner DFU Severity Score KO";

async function panelFor(page, name) {
  return page.getByText(name, { exact: true }).first().locator("xpath=ancestor::details[1]");
}

async function panelIsOpen(panel) {
  return panel.evaluate((element) => element.open);
}

async function exerciseFullscreenView(page, { action, close, heading }) {
  await page.getByRole("button", { name: action, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.height - viewport.height)).toBeLessThanOrEqual(2);
  await dialog.getByRole("button", { name: close, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Knowledge Objects", exact: true })).toBeVisible();
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

async function runJourney(page, url) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Knowledge Objects", exact: true })).toBeVisible();

  const panels = page.locator("details").filter({ has: page.getByRole("button", { name: /^Open .+ files$/ }) });
  await expect(panels).toHaveCount(4);
  for (const panel of await panels.all()) expect(await panelIsOpen(panel)).toBe(false);

  const panel = await panelFor(page, objectName);
  await page.getByText(objectName, { exact: true }).first().click();
  expect(await panelIsOpen(panel)).toBe(true);
  await expect(panel.getByText("Size", { exact: true })).toBeVisible();
  await expect(panel.getByText("Knowledge Elements", { exact: true })).toBeVisible();
  await expect(panel.getByText("Method", { exact: true })).toBeVisible();
  await page.getByText(objectName, { exact: true }).first().click();
  expect(await panelIsOpen(panel)).toBe(false);

  const views = {
    overview: await exerciseFullscreenView(page, {
      action: `Open ${objectName} overview`,
      close: "Close knowledge object overview",
      heading: objectName,
    }),
    logic: await exerciseFullscreenView(page, {
      action: `Open ${objectName} logic`,
      close: "Close knowledge object logic",
      heading: objectName,
    }),
    files: await exerciseFullscreenView(page, {
      action: `Open ${objectName} files`,
      close: "Close knowledge object files",
      heading: objectName,
    }),
    runner: await exerciseFullscreenView(page, {
      action: `Run ${objectName}`,
      close: "Close Runner",
      heading: `Run · ${objectName}`,
    }),
  };

  expect(await panelIsOpen(panel)).toBe(false);
  expect(errors, `${url} produced no uncaught browser errors`).toEqual([]);
  return { panelCount: await panels.count(), summaryFacts: 3, views };
}

test("server and standalone editions share panel and full-screen-view journeys", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  const server = await runJourney(serverPage, editions.server);
  const standalone = await runJourney(standalonePage, editions.standalone);
  expect(standalone).toEqual(server);
  await serverPage.close();
  await standalonePage.close();
});
