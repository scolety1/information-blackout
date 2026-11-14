import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(root, "dist");
const fixturePath = resolve(root, "fixtures/hostile.html");

let server: Server;
let fixtureUrl: string;
let context: BrowserContext;
let profileDirectory: string;

test.beforeAll(async () => {
  const fixture = await readFile(fixturePath);
  server = createServer((request, response) => {
    if (request.url === "/fixtures/hostile.html") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(fixture);
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not start.");
  fixtureUrl = `http://127.0.0.1:${address.port}/fixtures/hostile.html`;

  profileDirectory = await mkdtemp(join(tmpdir(), "information-blackout-e2e-"));
  context = await chromium.launchPersistentContext(profileDirectory, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
});

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((resolveClose, reject) =>
    server?.close((error) => (error ? reject(error) : resolveClose())),
  );
  if (profileDirectory) await rm(profileDirectory, { recursive: true, force: true });
});

test("configures topics in the popup and protects, reveals, and dynamically rescans a hostile page", async () => {
  const discoveryPage = await context.newPage();
  await discoveryPage.goto("chrome://extensions/");
  const extensionItem = discoveryPage.locator("extensions-item").filter({ hasText: "Information Blackout" });
  await expect(extensionItem).toHaveCount(1);
  const extensionId = await extensionItem.getAttribute("id");
  expect(extensionId).toBeTruthy();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await popup.getByLabel("Topic name").fill("Severance");
  await popup.getByLabel(/Aliases/).fill("Lumon\nMark Scout\nMacrodata Refinement");
  await popup.getByRole("button", { name: "Add protected topic" }).click();
  await expect(popup.getByRole("heading", { name: "Severance", exact: true })).toBeVisible();

  await popup.getByLabel("Disable Severance").uncheck();
  await expect(popup.getByText("Severance protection disabled.")).toBeVisible();
  await popup.getByLabel("Enable Severance").check();
  await expect(popup.getByText("Severance protection enabled.")).toBeVisible();

  await popup.getByLabel("Topic name").fill("Delete Me");
  await popup.getByRole("button", { name: "Add protected topic" }).click();
  await popup.getByLabel("Delete Delete Me").click();
  await expect(popup.getByRole("heading", { name: "Delete Me" })).toHaveCount(0);

  await popup.getByLabel("Topic name").fill("Denver Nuggets");
  await popup.getByLabel(/Aliases/).fill("Nuggets\nJokic\nNikola Jokic");
  await popup.getByRole("button", { name: "Add protected topic" }).click();
  await expect(popup.getByRole("heading", { name: "Denver Nuggets" })).toBeVisible();

  const page = await context.newPage();
  await page.goto(fixtureUrl);

  await expect(page.locator("#obvious-severance[data-ib-protected='true']")).toBeVisible();
  await expect(page.locator("#obvious-ending[data-ib-protected='true']")).toBeVisible();
  await expect(page.locator("#benign-started[data-ib-protected='true']")).toHaveCount(0);
  await expect(page.locator("#benign-started")).toContainText("started watching Severance");
  await expect(page.locator("#benign-streaming[data-ib-protected='true']")).toHaveCount(0);
  await expect(page.locator("#indirect-lumon[data-ib-protected='true']")).toBeVisible();
  await expect(page.locator("#indirect-benign[data-ib-protected='true']")).toHaveCount(0);
  await expect(page.locator("#sports-benign[data-ib-protected='true']")).toHaveCount(0);
  await expect(page.locator("#sports-result[data-ib-protected='true']")).toBeVisible();
  await expect(page.locator("#noise-headline[data-ib-protected='true']")).toHaveCount(0);
  await expect(page.locator("#noise-copy[data-ib-protected='true']")).toHaveCount(0);

  await expect(page.locator("#nested-headline[data-ib-protected='true']")).toBeVisible();
  await expect(page.locator("#nested-card[data-ib-protected='true']")).toHaveCount(0);
  await expect(page.locator("#nested-benign-snippet")).toContainText(/production design/i);

  const reveal = page.locator("#obvious-severance .ib-reveal-button");
  await expect(reveal).toBeVisible();
  await reveal.click();
  await expect(page.locator("#obvious-severance[data-ib-protected='true']")).toHaveCount(0);
  await expect(page.locator("#obvious-severance")).toContainText("testing floor is still active");

  await page.locator("#load-more").click();
  await expect(page.locator("#dynamic-spoiler[data-ib-protected='true']")).toBeVisible();
  await expect(page.locator("#dynamic-feed > article")).toHaveCount(1);
});
