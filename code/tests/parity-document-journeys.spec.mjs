import { expect, test } from "@playwright/test";

const editions = {
  server: "http://127.0.0.1:3100/",
  standalone: new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url).href,
};

const objectName = "DFU Severity Score KO";

async function downloadedDocx(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.byteLength).toBeGreaterThan(1_000);
  expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  return { fileName: download.suggestedFilename(), byteLength: bytes.byteLength };
}

async function documentJourney(page, url) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Knowledge Objects", exact: true })).toBeVisible();

  await page.getByText(objectName, { exact: true }).first().click();
  const specsButton = page.getByRole("button", { name: `Open ${objectName} full CKS specification`, exact: true });
  await expect(specsButton).toBeVisible();
  await specsButton.click();
  const specsDialog = page.getByRole("dialog", { name: /\.docx$/ });
  await expect(specsDialog).toBeVisible();
  const specsTitle = await specsDialog.getByRole("heading", { level: 2 }).textContent();
  expect(specsTitle).toContain(".docx");
  expect(specsTitle).not.toMatch(/One-Page|Summary/i);
  await expect(specsDialog.getByRole("button", { name: "Download Original", exact: true })).toBeVisible();
  await specsDialog.getByRole("button", { name: "Close document", exact: true }).click();
  await expect(specsDialog).toHaveCount(0);

  await page.getByRole("button", { name: `Open ${objectName} files`, exact: true }).click();
  const filesDialog = page.getByRole("dialog", { name: objectName, exact: true });
  await expect(filesDialog).toBeVisible();
  const viewDocumentButton = filesDialog.getByRole("button", { name: "View Document", exact: true });
  const downloadOriginalButton = filesDialog.getByRole("button", { name: "Download Original", exact: true });
  await expect(filesDialog.getByText(/Meggitt-Wagner_CKS_One-Page_Clinical-Knowledge_Summary\.docx/).first()).toBeVisible();
  await expect(viewDocumentButton).toBeVisible();
  await expect(downloadOriginalButton).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await downloadOriginalButton.click();
  const original = await downloadedDocx(await downloadPromise);
  expect(original.fileName).toBe("Meggitt-Wagner_CKS_One-Page_Clinical-Knowledge_Summary.docx");

  await viewDocumentButton.click();
  const documentDialog = page.getByRole("dialog", { name: /Meggitt-Wagner_CKS_One-Page_Clinical-Knowledge_Summary\.docx/ });
  await expect(documentDialog).toBeVisible();
  await expect(documentDialog.getByRole("heading", { name: /Meggitt-Wagner_CKS_One-Page_Clinical-Knowledge_Summary\.docx/ })).toBeVisible();
  await expect(documentDialog.getByText(/Purpose\./).first()).toBeVisible();
  await expect(documentDialog.getByText("Read-only document projection", { exact: true })).toBeVisible();
  await expect(documentDialog.getByRole("button", { name: "Download Original", exact: true })).toBeVisible();
  await documentDialog.getByRole("button", { name: "Close document", exact: true }).click();
  await expect(documentDialog).toHaveCount(0);

  await filesDialog.getByRole("button", { name: "Close knowledge object files", exact: true }).click();
  await expect(filesDialog).toHaveCount(0);
  expect(errors, `${url} produced no uncaught browser errors`).toEqual([]);
  return { ...original, specsTitle };
}

test("server and standalone editions view and download the same original DOCX", async ({ browser }) => {
  const serverPage = await browser.newPage();
  const standalonePage = await browser.newPage();
  const server = await documentJourney(serverPage, editions.server);
  const standalone = await documentJourney(standalonePage, editions.standalone);
  expect(standalone).toEqual(server);
  await serverPage.close();
  await standalonePage.close();
});
