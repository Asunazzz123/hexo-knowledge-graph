"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const vm = require("node:vm");

const plugin = require("../index");
const { getConfig } = require("../lib/config");
const { renderMount } = require("../lib/render");

function createFakeHexo(config = {}) {
  const registered = {
    generators: new Map(),
    helpers: new Map(),
    tags: new Map(),
    injections: []
  };

  return {
    config,
    base_dir: process.cwd(),
    extend: {
      generator: {
        register(name, fn) {
          registered.generators.set(name, fn);
        }
      },
      helper: {
        register(name, fn) {
          registered.helpers.set(name, fn);
        }
      },
      tag: {
        register(name, fn) {
          registered.tags.set(name, fn);
        }
      },
      injector: {
        register(entry, value, to) {
          registered.injections.push({ entry, value, to });
        }
      }
    },
    registered
  };
}

test("registers automatically when loaded through the Hexo plugin wrapper", () => {
  const entryPath = path.join(__dirname, "..", "index.js");
  const source = fs.readFileSync(entryPath, "utf8");
  const moduleRef = new Module(entryPath);
  moduleRef.filename = entryPath;
  moduleRef.paths = Module._nodeModulePaths(entryPath);
  const wrapped = vm.runInThisContext(
    `(function(exports, require, module, __filename, __dirname, hexo){${source}\n})`,
    { filename: entryPath }
  );
  const hexo = createFakeHexo({ knowledge_graph: {} });

  wrapped(
    moduleRef.exports,
    moduleRef.require.bind(moduleRef),
    moduleRef,
    entryPath,
    path.dirname(entryPath),
    hexo
  );

  assert.equal(hexo.registered.generators.has("knowledge_graph"), true);
});

test("normalizes snake-case Hexo configuration", () => {
  const config = getConfig({
    knowledge_graph: {
      auto_mount: false,
      categories_path: "/topics/",
      target_selector: "#topic-list",
      include_uncategorized: true
    }
  });

  assert.equal(config.autoMount, false);
  assert.equal(config.categoriesPath, "/topics/");
  assert.equal(config.targetSelector, "#topic-list");
  assert.equal(config.includeUncategorized, true);
  assert.equal(config.dataUrl, "/knowledge-graph/graph.json");
});

test("renders escaped mount attributes", () => {
  const html = renderMount({
    id: 'graph"><script>',
    title: "<Knowledge>",
    dataUrl: "/graph/data.json",
    height: "520px"
  });

  assert.match(html, /id="graph&quot;&gt;&lt;script&gt;"/);
  assert.match(html, /&lt;Knowledge&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("registers generator, helper, tag, and standard Injector assets", () => {
  const hexo = createFakeHexo({
    root: "/blog/",
    knowledge_graph: {}
  });

  plugin.register(hexo, {
    resolveForceGraphAsset() {
      return __filename;
    }
  });

  assert.equal(hexo.registered.generators.has("knowledge_graph"), true);
  assert.equal(hexo.registered.helpers.has("knowledge_graph"), true);
  assert.equal(hexo.registered.tags.has("knowledge_graph"), true);
  assert.deepEqual(
    hexo.registered.injections.map(({ entry, to }) => [entry, to]),
    [
      ["head_end", "default"],
      ["body_end", "default"]
    ]
  );
});

test("generator emits graph JSON and local browser assets", async () => {
  const hexo = createFakeHexo({ knowledge_graph: {} });
  plugin.register(hexo, {
    resolveForceGraphAsset() {
      return __filename;
    }
  });

  const generator = hexo.registered.generators.get("knowledge_graph");
  const routes = await generator({
    posts: [],
    categories: []
  });

  assert.deepEqual(routes.map((route) => route.path), [
    "knowledge-graph/graph.json",
    "knowledge-graph/knowledge-graph.js",
    "knowledge-graph/knowledge-graph.css",
    "knowledge-graph/force-graph.min.js"
  ]);
  assert.match(String(routes[0].data), /"nodes":\[\]/);
  assert.equal(typeof routes[1].data, "function");
  assert.equal(typeof routes[2].data, "function");
  assert.equal(typeof routes[3].data, "function");
});

test("ships an opaque graph background fallback for theme compatibility", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "assets", "knowledge-graph.css"),
    "utf8"
  );

  assert.match(
    css,
    /background-color:\s*var\(--body-bg-color,\s*#fff\)/
  );
});
