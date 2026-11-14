import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
const extensionPath = resolve(root, ".mission3-lab-dist");
let server: Server;
let baseUrl: string;
let context: BrowserContext;
let profileDirectory: string;
const requests: string[] = [];

async function openLab(query = ""): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/semantic-lab.html${query}`);
  return page;
}

test.describe.serial("Mission 3 isolated local semantic browser lab", () => {
  test.beforeAll(async () => {
    const fixture = await readFile(resolve(root, "fixtures/semantic-lab.html"));
    server = createServer((request, response) => {
      if (request.url?.startsWith("/semantic-lab.html")) {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(fixture);
        return;
      }
      response.writeHead(404);
      response.end("Not found");
    });
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Semantic fixture server did not start.");
    baseUrl = `http://127.0.0.1:${address.port}`;
    profileDirectory = await mkdtemp(join(tmpdir(), "information-blackout-m3-lab-"));
    context = await chromium.launchPersistentContext(profileDirectory, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    context.on("request", (request) => requests.push(request.url()));
  });

  test.afterAll(async () => {
    await context?.close();
    await new Promise<void>((resolveClose, reject) => {
      server?.close((error) => error ? reject(error) : resolveClose());
      server?.closeAllConnections();
    });
    if (profileDirectory) await rm(profileDirectory, { recursive: true, force: true });
  });

  test("semantic disabled preserves deterministic decisions and performs no inference", async () => {
    const page = await openLab("?semanticOff=1");
    await expect(page.locator("html")).toHaveAttribute("data-semantic-model-status", "disabled");
    await expect(page.locator("#explicit-spoiler[data-ib-protected='true']")).toBeVisible();
    await expect(page.locator("#indirect-spoiler[data-ib-protected='true']")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-semantic-inference-count", /.+/u);
    await page.close();
  });

  test("initializes locally, protects an indirect reveal, preserves a benign theory, and reveals", async () => {
    const requestStart = requests.length;
    const page = await openLab();
    await expect(page.locator("html")).toHaveAttribute("data-semantic-model-status", "ready", { timeout: 30_000 });
    await expect(page.locator("#indirect-spoiler")).toHaveAttribute("data-semantic-status", "ready", { timeout: 15_000 });
    await expect(page.locator("#indirect-spoiler[data-ib-protected='true']")).toHaveAttribute("data-semantic-source", "semantic", { timeout: 15_000 });
    await expect(page.locator("#benign-theory[data-ib-protected='true']")).toHaveCount(0);
    await expect(page.locator("#benign-theory")).toHaveAttribute("data-semantic-source", "deterministic-benign");
    await expect(page.locator("#explicit-spoiler[data-ib-protected='true']")).toHaveAttribute("data-semantic-source", "deterministic-spoiler");
    await page.locator("#indirect-spoiler .m3-lab-overlay button").click();
    await expect(page.locator("#indirect-spoiler[data-ib-revealed='true']")).toBeVisible();
    const remoteRequests = requests.slice(requestStart).filter((url) => /^https?:/u.test(url) && !url.startsWith(baseUrl));
    expect(remoteRequests).toEqual([]);
    await page.close();
  });

  test("worker initialization failure keeps high-confidence protection and falls back safely", async () => {
    const page = await openLab("?forceFailure=1");
    await expect(page.locator("html")).toHaveAttribute("data-semantic-model-status", "failed");
    await expect(page.locator("#explicit-spoiler[data-ib-protected='true']")).toHaveAttribute("data-semantic-source", "deterministic-spoiler");
    await expect(page.locator("#indirect-spoiler")).toHaveAttribute("data-semantic-source", "fallback");
    await expect(page.locator("#indirect-spoiler[data-ib-protected='true']")).toHaveCount(0);
    await page.close();
  });

  test("dynamic burst reaches a bounded queue without freezing or concealing the page wholesale", async () => {
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
    const page = await openLab();
    await expect(page.locator("html")).toHaveAttribute("data-semantic-model-status", "ready", { timeout: 30_000 });
    const started = Date.now();
    await page.locator("#add-burst").click();
    await expect(page.locator("#burst article")).toHaveCount(80);
    expect(Date.now() - started).toBeLessThan(5_000);
    await expect(page.locator("#burst article[data-semantic-status]")).toHaveCount(80, { timeout: 30_000 });
    const inferenceCount = Number(await page.locator("html").getAttribute("data-semantic-inference-count"));
    const maxPending = Number(await page.locator("html").getAttribute("data-semantic-max-pending"));
    expect(inferenceCount).toBeGreaterThan(0);
    expect(inferenceCount).toBeLessThanOrEqual(83);
    expect(maxPending).toBeLessThanOrEqual(83);
    const overloaded = await page.locator("#burst article[data-semantic-status='overloaded']").count();
    if (overloaded === 0) expect(maxPending).toBeLessThanOrEqual(32);
    else expect(overloaded).toBeGreaterThan(0);
    await expect(page.locator("body[data-ib-protected='true']")).toHaveCount(0);
    await page.close();
  });
});
