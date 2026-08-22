import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

const bindings = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const context = { waitUntil() {}, passThroughOnException() {} };

test("renders the CrossCare portfolio dashboard", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    bindings,
    context,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /CrossCare AI/);
  assert.match(html, /跨境电商售后指挥中心/);
  assert.match(html, /售后指挥中心/);
  assert.match(html, /把异常留给系统/);
  assert.match(html, /按需巡检可用/);
  assert.doesNotMatch(html, /作品集评测设计|AGENT WORKFLOW/);
});

test("exposes a lightweight health endpoint", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/health"),
    bindings,
    context,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.service, "crosscare-ai");
});

test("rejects cross-site mutation requests before database access", async () => {
  const worker = await loadWorker();
  for (const pathname of [
    "/api/monitor/run",
    "/api/cases/CASE-1005/run",
  ]) {
    const response = await worker.fetch(
      new Request(`https://crosscare.example${pathname}`, {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
      }),
      bindings,
      context,
    );
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.code, "invalid_request_origin");
  }
});

test("falls back to an in-memory mutation limit when D1 is unavailable", async () => {
  const worker = await loadWorker();
  const statuses = [];
  for (let index = 0; index < 7; index += 1) {
    const response = await worker.fetch(
      new Request("https://crosscare.example/api/monitor/run", {
        method: "POST",
        headers: {
          origin: "https://crosscare.example",
          "sec-fetch-site": "same-origin",
          "user-agent": "crosscare-rate-limit-test",
          "cf-connecting-ip": "192.0.2.10",
        },
      }),
      bindings,
      context,
    );
    statuses.push(response.status);
    if (index === 6) {
      assert.equal(response.headers.has("retry-after"), true);
      const payload = await response.json();
      assert.equal(payload.code, "rate_limit_exceeded");
    }
  }

  assert.deepEqual(statuses.slice(0, 6), [503, 503, 503, 503, 503, 503]);
  assert.equal(statuses[6], 429);
});

test("ships migrations for cases, policies and audit history", async () => {
  const migrations = (await readdir(new URL("../drizzle/", import.meta.url))).filter((name) => name.endsWith(".sql"));
  assert.ok(migrations.length > 0);
  const sql = (
    await Promise.all(
      migrations.map((name) =>
        readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  assert.match(sql, /CREATE TABLE `support_cases`/);
  assert.match(sql, /CREATE TABLE `policies`/);
  assert.match(sql, /CREATE TABLE `monitor_runs`/);
  assert.match(sql, /CREATE TABLE `audit_events`/);
  assert.match(sql, /CREATE TABLE `mutation_rate_limits`/);
  assert.match(sql, /mutation_rate_limits_window_start_idx/);
});

test("retires only the obsolete seeded Shopify demo case", async () => {
  const repository = await readFile(
    new URL("../db/repository.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL(
      "../drizzle/0002_remove-obsolete-shopify-demo.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(repository, /SHOP-7291684585704/);
  assert.match(migration, /DELETE FROM `audit_events`/);
  assert.match(migration, /DELETE FROM `support_cases`/);
  assert.match(migration, /`id` = 'SHOP-7291684585704'/);
  assert.match(migration, /`source` = 'demo'/);
  assert.match(migration, /`customer_name` = 'Shopify 测试客户'/);
});
