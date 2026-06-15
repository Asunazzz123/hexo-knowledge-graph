"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildGraphData,
  normalizeLookupKey
} = require("../lib/graph-builder");

test("keeps malformed URI escapes as literal post-link lookup text", () => {
  assert.equal(normalizeLookupKey("notes/100%"), "notes/100%");
});

function category(id, name, parent = null) {
  return {
    _id: id,
    name,
    parent,
    path: `categories/${name}/`
  };
}

function post(source, title, categories, raw = "", tags = []) {
  return {
    source: `_posts/${source}.md`,
    slug: source.split("/").at(-1),
    title,
    path: `2026/06/15/${encodeURIComponent(title)}/`,
    categories,
    tags,
    raw
  };
}

test("builds top-level category roots and solid membership links", () => {
  const root = category("cat-cs", "CS");
  const child = category("cat-llm", "LLM", "cat-cs");
  const math = category("cat-math", "数学");
  const posts = [
    post("CS/LLM/deepnet", "DeepNet", [root, child]),
    post("math/measure", "测度论", [math])
  ];

  const graph = buildGraphData({ posts, categories: [root, child, math] });

  assert.deepEqual(
    graph.nodes.filter((node) => node.type === "category").map((node) => node.name),
    ["CS", "数学"]
  );
  assert.deepEqual(
    graph.links.filter((link) => link.type === "category").map((link) => [
      link.source,
      link.target
    ]),
    [
      ["category:cat-cs", "post:CS/LLM/deepnet"],
      ["category:cat-math", "post:math/measure"]
    ]
  );
});

test("creates one dashed reference edge with anchor metadata", () => {
  const llm = category("cat-llm", "LLM");
  const posts = [
    post(
      "CS/LLM/deepnet",
      "DeepNet",
      [llm],
      [
        "{% post_link CS/LLM/ln#post-ln Post-LN %}",
        "{% post_link CS/LLM/ln#pre-ln Pre-LN %}"
      ].join("\n")
    ),
    post("CS/LLM/ln", "LayerNorm", [llm])
  ];

  const graph = buildGraphData({ posts, categories: [llm] });
  const references = graph.links.filter((link) => link.type === "reference");

  assert.equal(references.length, 1);
  assert.equal(references[0].source, "post:CS/LLM/deepnet");
  assert.equal(references[0].target, "post:CS/LLM/ln");
  assert.deepEqual(references[0].references, [
    { anchor: "post-ln", label: "Post-LN" },
    { anchor: "pre-ln", label: "Pre-LN" }
  ]);
  assert.equal(references[0].dashed, true);
});

test("resolves post_link by title and reports unresolved targets", () => {
  const cs = category("cat-cs", "CS");
  const posts = [
    post(
      "CS/source",
      "Source",
      [cs],
      "{% post_link Target %}\n{% post_link Missing %}"
    ),
    post("CS/target", "Target", [cs])
  ];

  const graph = buildGraphData({ posts, categories: [cs] });

  assert.equal(
    graph.links.filter((link) => link.type === "reference").length,
    1
  );
  assert.deepEqual(graph.meta.unresolvedReferences, [
    { source: "CS/source", target: "Missing" }
  ]);
});

test("does not create tag nodes or self-reference links", () => {
  const cs = category("cat-cs", "CS");
  const posts = [
    post(
      "CS/source",
      "Source",
      [cs],
      "{% post_link CS/source %}",
      [{ name: "tag-a" }]
    )
  ];

  const graph = buildGraphData({ posts, categories: [cs] });

  assert.equal(graph.nodes.some((node) => node.type === "tag"), false);
  assert.equal(
    graph.links.some((link) => link.type === "reference"),
    false
  );
});

test("can include uncategorized posts behind a synthetic root", () => {
  const graph = buildGraphData(
    {
      posts: [post("misc/note", "Loose Note", [])],
      categories: []
    },
    {
      includeUncategorized: true,
      uncategorizedLabel: "未分类"
    }
  );

  assert.equal(graph.nodes[0].id, "category:uncategorized");
  assert.equal(graph.nodes[0].name, "未分类");
  assert.equal(graph.links[0].type, "category");
});
