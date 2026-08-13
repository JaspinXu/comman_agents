import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the comman_agents demo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>comman_agents · 群像<\/title>/i);
  assert.match(html, /comman_agents/);
  assert.match(html, /产品共创小组/);
  assert.match(html, /Local Engine/);
  assert.match(html, /Python 编排器驱动/);
  assert.match(html, /POST \/api\/runs/);
  assert.match(html, /林溪/);
  assert.match(html, /程野/);
  assert.match(html, /沈知/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("keeps persona configuration transparent and local-demo safe", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /schema:\s*"comman_agents\/v1"/);
  assert.match(page, /\/api\/health/);
  assert.match(page, /\/api\/agents/);
  assert.match(page, /\/api\/runs/);
  assert.match(page, /response\.body\.getReader/);
  assert.match(page, /JSON\.stringify/);
  assert.doesNotMatch(page, /exportConfig|导出全部配置|rail-note|export-button/);
  assert.match(page, /toggleTool/);
  assert.match(page, /runScene/);
  assert.match(page, /createAgent/);
  assert.match(page, /generatePortrait/);
  assert.match(page, /sendChat/);
  assert.match(page, /1v1 对话/);
  assert.match(page, /\/portrait/);
  assert.match(page, /\/chat/);
  assert.doesNotMatch(page, /person-card-hit|person-copy|portrait-figure|tool-dots/);
  assert.match(page, /method:\s*"POST"/);
  assert.match(page, /添加新人物/);
  assert.match(page, /comman agents/);
  assert.doesNotMatch(page, /MULTI-AGENT COMPOSITION STUDIO/);
  assert.match(layout, /comman_agents · 群像/);
  assert.match(packageJson, /"name": "comman_agents"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
