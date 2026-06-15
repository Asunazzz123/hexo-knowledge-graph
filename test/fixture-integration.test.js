"use strict";

const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const plugin = require("../index");
const { defaultResolveForceGraphAsset } = require("../lib/routes");

class Collection {
  constructor(items) {
    this.items = items;
  }

  toArray() {
    return this.items.slice();
  }
}

function createHexo() {
  const generators = new Map();
  return {
    config: {
      root: "/",
      knowledge_graph: {}
    },
    extend: {
      generator: {
        register(name, fn) {
          generators.set(name, fn);
        }
      },
      helper: { register() {} },
      tag: { register() {} },
      injector: { register() {} }
    },
    generators
  };
}

test("resolves the installed local force-graph browser bundle", () => {
  const asset = defaultResolveForceGraphAsset();

  assert.equal(fs.existsSync(asset), true);
  assert.equal(asset.endsWith("force-graph.min.js"), true);
});

test("generates graph JSON from Hexo Collection-style locals", async () => {
  const category = {
    _id: "llm",
    name: "LLM",
    path: "categories/LLM/"
  };
  const posts = [
    {
      source: "_posts/CS/LLM/deepnet.md",
      title: "DeepNet",
      path: "deepnet/",
      categories: new Collection([category]),
      _content: "{% post_link CS/LLM/ln %}"
    },
    {
      source: "_posts/CS/LLM/ln.md",
      title: "LayerNorm",
      path: "layernorm/",
      categories: new Collection([category]),
      _content: ""
    }
  ];
  const hexo = createHexo();
  plugin.register(hexo);

  const routes = await hexo.generators.get("knowledge_graph")({
    posts: new Collection(posts),
    categories: new Collection([category])
  });
  const graph = JSON.parse(routes[0].data);

  assert.equal(graph.meta.categoryCount, 1);
  assert.equal(graph.meta.postCount, 2);
  assert.equal(graph.meta.referenceCount, 1);
  // Knowledge map enrichment adds topic nodes and links
  assert.equal(typeof graph.meta.topicCount, "number");
  assert.ok(graph.meta.topicCount > 0);
  assert.equal(typeof graph.meta.topicLinkCount, "number");
  assert.ok(graph.meta.topicLinkCount > 0);
  // Check that real post data is still present
  assert.ok(graph.nodes.some(function (n) { return n.type === "post" && n.name === "DeepNet"; }));
  assert.ok(graph.nodes.some(function (n) { return n.type === "post" && n.name === "LayerNorm"; }));
  var linkTypes = graph.links.map(function (link) { return link.type; });
  assert.ok(linkTypes.includes("category"));
  assert.ok(linkTypes.includes("reference"));
  assert.ok(linkTypes.includes("topic"));
});
