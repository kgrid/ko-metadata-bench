import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};

const views = [
  { key: "knowledgeObjects", heading: "Knowledge Objects", control: "Knowledge Objects", background: "rgb(245, 245, 247)" },
  { key: "metadata", heading: "Metadata", control: "Metadata Rig", background: "rgb(228, 237, 244)" },
  { key: "findability", heading: "Findability", control: "F exercise", background: "rgb(245, 245, 247)" },
  { key: "accessibility", heading: "Access", control: "A exercise", background: "rgb(245, 245, 247)" },
  { key: "interoperability", heading: "Interoperability", control: "I exercise", background: "rgb(245, 245, 247)" },
  { key: "reusability", heading: "Reusability", control: "R exercise", background: "rgb(245, 245, 247)" },
];

async function effectiveBackground(locator) {
  return locator.evaluate((element) => {
    let current = element;
    while (current) {
      const color = getComputedStyle(current).backgroundColor;
      if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
      current = current.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  });
}

async function workspaceSnapshot(page, view) {
  if (view.key !== "knowledgeObjects") {
    await page.getByRole("button", { name: view.control, exact: true }).click();
  }
  const heading = page.getByRole("heading", { name: view.heading, exact: true });
  await expect(heading).toBeVisible();
  const section = heading.locator("xpath=ancestor::section[1]");
  const titleBand = heading.locator("xpath=ancestor::div[contains(@class, 'viewStickyControls') or contains(@class, 'view-sticky-controls')][1]");
  const sectionStyle = await section.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      display: style.display,
      flexDirection: style.flexDirection,
      alignItems: style.alignItems,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
    };
  });
  const snapshot = {
    bodyBackground: await effectiveBackground(page.locator("body")),
    workspaceBackground: await effectiveBackground(section),
    titleBandBackground: await effectiveBackground(titleBand),
    sectionStyle,
  };
  expect(snapshot.bodyBackground, `${view.heading} uses the common page background`).toBe("rgb(245, 245, 247)");
  expect(snapshot.workspaceBackground, `${view.heading} uses its intended workspace background`).toBe(view.background);
  expect(snapshot.titleBandBackground, `${view.heading} title band continues its workspace background`).toBe(view.background);
  expect(snapshot.sectionStyle, `${view.heading} uses the common workspace layout`).toEqual({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: "34px",
    paddingRight: "24px",
    paddingBottom: "28px",
    paddingLeft: "24px",
  });
  return snapshot;
}

async function editionSnapshots(page, url) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const snapshots = {};
  for (const view of views) snapshots[view.key] = await workspaceSnapshot(page, view);
  expect(errors, `${url} produced no uncaught browser errors`).toEqual([]);
  return snapshots;
}

test("server and standalone editions share main backgrounds and workspace styles", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  const server = await editionSnapshots(serverPage, editions.server);
  const standalone = await editionSnapshots(standalonePage, editions.standalone);
  expect(standalone).toEqual(server);
  await serverPage.close();
  await standalonePage.close();
});

test("Metadata Rig and F/A/I/R share a 920-pixel grid limit in both editions", async ({ browser }) => {
  const grids = [
    { control: "Metadata Rig", selector: ".metadataRigGrid, .metadata-rig-grid" },
    { control: "F exercise", selector: ".searchResults, .search-results" },
    { control: "A exercise", selector: ".accessibilityGrid, .accessibility-grid" },
    { control: "I exercise", selector: ".interoperabilityGrid, .interoperability-grid" },
    { control: "R exercise", selector: ".reusabilityGrid, .reusability-grid" },
  ];
  for (const [edition, url] of Object.entries(editions)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    for (const { control, selector } of grids) {
      await page.getByRole("button", { name: control, exact: true }).click();
      const grid = page.locator(selector).first();
      await expect(grid).toBeVisible();
      expect(await grid.evaluate((node) => node.getBoundingClientRect().width), `${edition}: ${control}`).toBe(920);
    }
    await page.close();
  }
});

test("Knowledge banners use the 1040-pixel grid cap in both editions", async ({ browser }) => {
  for (const [edition, url] of Object.entries(editions)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "K exercise", exact: true }).click();
    const grid = page.locator(".knowledgeGrid, .knowledge-grid");
    await expect(grid).toBeVisible();
    expect(await grid.evaluate((node) => node.getBoundingClientRect().width), `${edition}: Knowledge grid`).toBe(1040);
    await page.close();
  }
});

test("KO banners share their base treatment across views and editions", async ({ browser }) => {
  const banners = [
    { control: "Knowledge Objects", selector: ".koObjectShade, .ko-object-shade" },
    { control: "Metadata Rig", selector: ".metadataRigCard, .metadata-rig-card" },
    { control: "K exercise", selector: ".knowledgeCard, .knowledge-card" },
    { control: "F exercise", selector: ".resultGroup, .result-group" },
    { control: "A exercise", selector: ".accessibilityCard, .accessibility-card" },
    { control: "I exercise", selector: ".interoperabilityPanel, .interoperability-panel" },
    { control: "R exercise", selector: ".reusabilityCard, .reusability-card" },
  ];
  for (const [edition, url] of Object.entries(editions)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    for (const { control, selector } of banners) {
      if (control !== "Knowledge Objects") await page.getByRole("button", { name: control, exact: true }).click();
      const banner = page.locator(selector).first();
      await expect(banner, `${edition}: ${control} banner`).toBeVisible();
      const treatment = await banner.evaluate((node) => {
        const summary = node.querySelector(":scope > summary");
        const name = summary?.querySelector(":scope > strong");
        const box = getComputedStyle(node);
        const summaryStyle = getComputedStyle(summary);
        const nameStyle = getComputedStyle(name);
        return {
          borderWidth: box.borderTopWidth,
          radius: box.borderTopLeftRadius,
          minHeight: summaryStyle.minHeight,
          chevron: getComputedStyle(summary, "::before").content,
          nameSize: nameStyle.fontSize,
          nameWeight: nameStyle.fontWeight,
        };
      });
      expect(treatment, `${edition}: ${control} shared banner treatment`).toEqual({
        borderWidth: "1px", radius: "11px", minHeight: "42px",
        chevron: '"›"', nameSize: "12px", nameWeight: "650",
      });
    }
    await page.close();
  }
});
