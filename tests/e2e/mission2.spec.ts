import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(root, "dist");
const fixtureNames = ["search-results.html", "social-feed.html", "video-feed.html", "sports-news.html", "long-form.html", "mission4-false-positive.html"];

let server: Server;
let baseUrl: string;
let context: BrowserContext;
let profileDirectory: string;
let extensionId: string;

async function openPopup(): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

async function addTopic(page: Page, name: string, aliases: string): Promise<void> {
  await page.getByLabel("Topic name").fill(name);
  await page.getByLabel(/Aliases/).fill(aliases);
  await page.getByRole("button", { name: "Add protected topic" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test.describe.serial("Mission 2 browser feedback and realistic-layout flows", () => {
  test.beforeAll(async () => {
    const fixtures = new Map<string, Buffer>();
    await Promise.all(fixtureNames.map(async (name) => fixtures.set(`/${name}`, await readFile(resolve(root, "fixtures", name)))));
    server = createServer((request, response) => {
      const fixture = fixtures.get(request.url ?? "");
      if (!fixture) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(fixture);
    });
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture server did not start.");
    baseUrl = `http://127.0.0.1:${address.port}`;

    profileDirectory = await mkdtemp(join(tmpdir(), "information-blackout-m2-e2e-"));
    context = await chromium.launchPersistentContext(profileDirectory, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const discovery = await context.newPage();
    await discovery.goto("chrome://extensions/");
    const item = discovery.locator("extensions-item").filter({ hasText: "Information Blackout" });
    await expect(item).toHaveCount(1);
    extensionId = (await item.getAttribute("id")) ?? "";
    expect(extensionId).toBeTruthy();
    await discovery.close();
  });

  test.afterAll(async () => {
    await context?.close();
    await new Promise<void>((resolveClose, reject) => server?.close((error) => error ? reject(error) : resolveClose()));
    if (profileDirectory) await rm(profileDirectory, { recursive: true, force: true });
  });

  test("creates, persists, disables, re-enables, and deletes topic configuration", async () => {
    const popup = await openPopup();
    await addTopic(popup, "Severance", "Lumon\nMark Scout\nMacrodata Refinement");
    await addTopic(popup, "Denver Nuggets", "Nuggets\nJokic\nNikola Jokic");
    await addTopic(popup, "Glass Horizon", "Captain Vale\nThe Meridian\nDirector Sato");
    await addTopic(popup, "Starfall Protocol", "Astra Vale\nHollow Regent\nSP");
    await addTopic(popup, "The Bear", "Bear\nCarmy");
    await addTopic(popup, "Delete Me", "Disposable");
    await popup.getByLabel("Delete Delete Me").click();
    await popup.reload();
    await expect(popup.getByRole("heading", { name: "Severance", exact: true })).toBeVisible();
    await expect(popup.getByRole("heading", { name: "Delete Me", exact: true })).toHaveCount(0);
    await popup.getByLabel("Disable Severance").uncheck();
    await expect(popup.getByText("Severance protection disabled.")).toBeVisible();
    await popup.getByLabel("Enable Severance").check();
    await expect(popup.getByText("Severance protection enabled.")).toBeVisible();
    await popup.close();
  });

  test("protects search results, preserves benign neighbors, and records Not a spoiler locally", async () => {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/search-results.html`);
    await expect(page.locator("#search-spoiler[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#search-benign[data-ib-protected='true']")).toHaveCount(0);
    await expect(page.locator("#search-collision[data-ib-protected='true']")).toHaveCount(0);
    await page.locator("#search-spoiler .ib-not-spoiler-button").click();
    await expect(page.locator("#search-spoiler[data-ib-feedback='false-positive']")).toBeVisible();
    await expect(page.locator(".ib-feedback-toast")).toContainText("correction saved locally");

    const inspector = await openPopup();
    const stored = await inspector.evaluate(async () => chrome.storage.local.get(["protectedTopics", "feedbackStats"]));
    const topics = stored.protectedTopics as Array<{ id: string; name: string }>;
    const severanceId = topics.find((topic) => topic.name === "Severance")?.id ?? "";
    expect((stored.feedbackStats as { byTopic: Record<string, { falsePositiveCount: number }> }).byTopic[severanceId]?.falsePositiveCount).toBe(1);
    expect(JSON.stringify(stored.feedbackStats)).not.toContain(baseUrl);
    await inspector.close();
    await page.close();
  });

  test("handles multiple topics and dynamic insertion in a nested social feed", async () => {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/social-feed.html`);
    await expect(page.locator("#social-tv-spoiler[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#social-sports-spoiler[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#social-benign-comment[data-ib-protected='true']")).toHaveCount(0);
    await page.locator("#load-post").click();
    await expect(page.locator("#social-dynamic-spoiler[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#social-dynamic-card[data-ib-protected='true']")).toHaveCount(0);
    await page.close();
  });

  test("protects minimal video and sports regions while Reveal restores one result", async () => {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/video-feed.html`);
    await expect(page.locator("#video-spoiler[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#video-game-spoiler[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#video-benign[data-ib-protected='true']")).toHaveCount(0);
    await expect(page.locator("#video-spoiler-card[data-ib-protected='true']")).toHaveCount(0);
    await page.locator("#video-spoiler .ib-reveal-button").click();
    await expect(page.locator("#video-spoiler[data-ib-protected='true']")).toHaveCount(0);

    await page.goto(`${baseUrl}/sports-news.html`);
    await expect(page.locator("#sports-completed[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#sports-live[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#sports-preview[data-ib-protected='true']")).toHaveCount(0);
    await expect(page.locator("#sports-schedule[data-ib-protected='true']")).toHaveCount(0);
    await page.close();
  });

  test("reports a missed spoiler, adds only an explicit alias, and immediately improves protection", async () => {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/long-form.html`);
    await expect(page.locator("#long-spoiler[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#long-benign[data-ib-protected='true']")).toHaveCount(0);
    await expect(page.locator("#missed-region[data-ib-protected='true']")).toHaveCount(0);

    const popup = await openPopup();
    await page.bringToFront();
    await popup.getByRole("button", { name: "Report missed spoiler" }).click();
    await expect(page.locator(".ib-report-panel")).toBeVisible();
    await page.locator("#missed-region").click();
    await page.getByLabel("Protected topic").selectOption({ label: "Severance" });
    await page.getByLabel("Optional alias or phrase to add").fill("Helly R");
    await page.getByRole("button", { name: "Save local feedback" }).click();
    await expect(page.locator(".ib-report-panel")).toHaveCount(0);
    await expect(page.locator("#missed-region[data-ib-protected='true']")).toBeVisible();

    const inspector = await openPopup();
    const stored = await inspector.evaluate(async () => chrome.storage.local.get(["protectedTopics", "feedbackStats"]));
    const topics = stored.protectedTopics as Array<{ id: string; name: string; aliases: string[] }>;
    const severance = topics.find((topic) => topic.name === "Severance");
    expect(severance?.aliases).toContain("Helly R");
    const aggregate = (stored.feedbackStats as { byTopic: Record<string, { missedSpoilerCount: number; aliasesAddedFromReports: number }> }).byTopic[severance?.id ?? ""];
    expect(aggregate).toMatchObject({ missedSpoilerCount: 1, aliasesAddedFromReports: 1 });
    const feedbackJson = JSON.stringify(stored.feedbackStats);
    expect(feedbackJson).not.toContain("betrays the team");
    expect(feedbackJson).not.toContain(baseUrl);
    await inspector.close();
    await page.close();
  });

  test("keeps a mixed false-positive attack feed readable while concealing confirmed and dynamic spoilers", async () => {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/mission4-false-positive.html`);
    for (const id of ["m4-prediction", "m4-question", "m4-theory", "m4-conditional", "m4-metadata", "m4-schedule", "m4-common-collision"]) {
      await expect(page.locator(`#${id}[data-ib-protected='true']`)).toHaveCount(0);
    }
    await expect(page.locator("#m4-confirmed[data-ib-protected='true']")).toBeVisible();
    await page.locator("#m4-confirmed .ib-reveal-button").click();
    await expect(page.locator("#m4-confirmed[data-ib-revealed='true']")).toBeVisible();
    await page.locator("#insert").click();
    await expect(page.locator("#m4-dynamic-confirmed[data-ib-protected='true']")).toBeVisible();
    await page.close();
  });

  test("topic deletion stops only that topic while other protection remains active", async () => {
    const popup = await openPopup();
    await popup.getByLabel("Delete Glass Horizon").click();
    await popup.close();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/video-feed.html`);
    await expect(page.locator("#video-spoiler[data-ib-protected='true']")).toHaveCount(0);
    await expect(page.locator("#video-game-spoiler[data-ib-protected='true']")).toBeVisible();
    await page.close();
  });
});
