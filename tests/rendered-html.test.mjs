import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
  assert.match(html, /点击名称即可编辑/);
  assert.match(html, /整体故事背景/);
  assert.match(html, /依次回答 · 自主交流/);
  assert.match(html, /林溪/);
  assert.match(html, /程野/);
  assert.match(html, /沈知/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("keeps persona configuration transparent and local-demo safe", async () => {
  const studioRoot = new URL("../app/studio/", import.meta.url);
  const studioFiles = (await readdir(studioRoot, { recursive: true }))
    .filter((name) => /\.tsx?$/.test(name));
  const [page, layout, packageJson, ...studioSources] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    ...studioFiles.map((name) => readFile(new URL(name, studioRoot), "utf8")),
  ]);
  const source = [page, ...studioSources].join("\n");

  assert.match(source, /schema:\s*"comman_agents\/v1"/);
  assert.match(source, /\/api\/health/);
  assert.match(source, /\/api\/agents/);
  assert.match(source, /\/api\/settings/);
  assert.match(source, /\/api\/runs/);
  assert.match(source, /response\.body\.getReader/);
  assert.match(source, /JSON\.stringify/);
  assert.doesNotMatch(source, /exportConfig|导出全部配置|rail-note|export-button/);
  assert.doesNotMatch(source, /服务端透明持久化|没有隐藏人格层|className="callout"/);
  assert.match(source, /askEnsemble/);
  assert.match(source, /storyBackground/);
  assert.match(source, /conversation/);
  assert.match(source, /createAgent/);
  assert.match(source, /updateGroupName/);
  assert.match(source, /group-name-input/);
  assert.match(source, /aria-label="团体名称"/);
  assert.match(source, /generatePortrait/);
  assert.doesNotMatch(source, /generatePortrait\(created\.id\)/);
  assert.match(source, /新人物暂用默认形象/);
  assert.match(source, /customAttributes/);
  assert.match(source, /自定义特征/);
  assert.match(source, /<span>性格<\/span>/);
  assert.doesNotMatch(source, /<span>代表性表达<\/span>/);
  assert.match(source, /deleteSelectedAgent/);
  assert.match(source, /method:\s*"DELETE"/);
  assert.match(source, /删除人物/);
  assert.match(source, /sendChat/);
  assert.match(source, /1v1 对话/);
  assert.match(source, /\/portrait/);
  assert.match(source, /\/chat/);
  assert.doesNotMatch(source, /person-card-hit|person-copy|portrait-figure|tool-dots/);
  assert.match(source, /method:\s*"POST"/);
  assert.match(source, /添加新人物/);
  assert.match(source, /comman agents/);
  assert.doesNotMatch(source, /场景库/);
  assert.doesNotMatch(source, /seedScenes|scene-flow|scene-card|需求探索|方案设计|观点辩论|风险评审/);
  assert.doesNotMatch(source, /MULTI-AGENT COMPOSITION STUDIO/);
  assert.match(layout, /comman_agents · 群像/);
  assert.match(packageJson, /"name": "comman_agents"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(packageJson, /drizzle/);
});
