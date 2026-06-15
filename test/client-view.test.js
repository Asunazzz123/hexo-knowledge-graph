"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createGraphController,
  disposeElement,
  linkLineDash,
  nodeValue,
  normalizePagePath,
  resolveLabelColors,
  scheduleZoomToFit,
  shouldAutoMount,
  selectGraphView
} = require("../client/knowledge-graph");

const graph = {
  nodes: [
    { id: "category:a", type: "category", name: "A" },
    { id: "category:b", type: "category", name: "B" },
    { id: "post:a1", type: "post", name: "A1" },
    { id: "post:a2", type: "post", name: "A2" },
    { id: "post:b1", type: "post", name: "B1", url: "/b1/" },
    { id: "post:b2", type: "post", name: "B2" }
  ],
  links: [
    { source: "category:a", target: "post:a1", type: "category" },
    { source: "category:a", target: "post:a2", type: "category" },
    { source: "category:b", target: "post:b1", type: "category" },
    { source: "category:b", target: "post:b2", type: "category" },
    { source: "post:a1", target: "post:a2", type: "reference" },
    { source: "post:a2", target: "post:b1", type: "reference" },
    { source: "post:b2", target: "post:a1", type: "reference" }
  ]
};

test("overview contains category roots only", () => {
  const view = selectGraphView(graph, null);

  assert.deepEqual(view.nodes.map((node) => node.id), [
    "category:a",
    "category:b"
  ]);
  assert.deepEqual(view.links, []);
});

test("focused view keeps members and outbound visitor posts", () => {
  const view = selectGraphView(graph, "category:a");

  assert.deepEqual(view.nodes.map((node) => [node.id, Boolean(node.visitor)]), [
    ["category:a", false],
    ["post:a1", false],
    ["post:a2", false],
    ["post:b1", true]
  ]);
  assert.deepEqual(view.links.map((link) => [
    link.source,
    link.target,
    link.type
  ]), [
    ["category:a", "post:a1", "category"],
    ["category:a", "post:a2", "category"],
    ["post:a1", "post:a2", "reference"],
    ["post:a2", "post:b1", "reference"]
  ]);
});

test("controller toggles categories, resets on background, and navigates posts", () => {
  const views = [];
  const navigations = [];
  const controller = createGraphController({
    graph,
    setView(view, selectedCategoryId) {
      views.push({ view, selectedCategoryId });
    },
    navigate(url) {
      navigations.push(url);
    }
  });

  controller.start();
  controller.handleNodeClick({ id: "category:a", type: "category" });
  controller.handleNodeClick({ id: "category:a", type: "category" });
  controller.handleNodeClick({ id: "category:b", type: "category" });
  controller.handleBackgroundClick();
  controller.handleNodeClick({ id: "post:b1", type: "post", url: "/b1/" });

  assert.deepEqual(views.map((entry) => entry.selectedCategoryId), [
    null,
    "category:a",
    null,
    "category:b",
    null
  ]);
  assert.deepEqual(navigations, ["/b1/"]);
});

test("normalizes pretty category URLs for automatic mounting", () => {
  assert.equal(normalizePagePath("/blog/categories/index.html"), "/blog/categories/");
  assert.equal(normalizePagePath("/blog/categories"), "/blog/categories/");
  assert.equal(
    shouldAutoMount(
      { pathname: "/blog/categories/index.html" },
      { autoMount: true, categoriesPath: "/blog/categories/" }
    ),
    true
  );
  assert.equal(
    shouldAutoMount(
      { pathname: "/blog/tags/" },
      { autoMount: true, categoriesPath: "/blog/categories/" }
    ),
    false
  );
});

test("uses dashed lines only for post references", () => {
  assert.deepEqual(linkLineDash({ type: "reference" }), [5, 7]);
  assert.deepEqual(linkLineDash({ type: "category" }), []);
});

test("renders category roots larger than posts and visitor nodes", () => {
  assert.equal(nodeValue({ type: "category" }), 90);
  assert.equal(nodeValue({ type: "post" }), 28);
  assert.equal(nodeValue({ type: "post", visitor: true }), 18);
});

test("schedules a padded zoom after the focused graph starts moving", () => {
  const calls = [];
  const graphInstance = {
    zoomToFit(duration, padding) {
      calls.push({ duration, padding });
    }
  };
  const scheduled = [];

  const timer = scheduleZoomToFit(graphInstance, (callback, delay) => {
    scheduled.push({ callback, delay });
    return 17;
  });

  assert.equal(timer, 17);
  assert.equal(scheduled[0].delay, 420);
  assert.deepEqual(calls, []);

  scheduled[0].callback();
  assert.deepEqual(calls, [{ duration: 520, padding: 48 }]);
});

test("uses the graph container text color for canvas labels", () => {
  const colors = resolveLabelColors({}, () => ({
    color: "rgb(224, 226, 232)"
  }));

  assert.deepEqual(colors, {
    default: "rgb(224, 226, 232)",
    visitor: "rgb(224, 226, 232)"
  });
  assert.deepEqual(resolveLabelColors(null, null), {
    default: "#3c4048",
    visitor: "#7f8791"
  });
});

test("disposes observers, timers, and the ForceGraph instance", () => {
  const calls = [];
  const element = {
    dataset: { knowledgeGraphMounted: "true" },
    knowledgeGraphFitTimer: 23,
    knowledgeGraphResizeObserver: {
      disconnect() {
        calls.push("resize");
      }
    },
    knowledgeGraphThemeObserver: {
      disconnect() {
        calls.push("theme");
      }
    },
    knowledgeGraphInstance: {
      pauseAnimation() {
        calls.push("pause");
      },
      _destructor() {
        calls.push("destroy");
      }
    },
    knowledgeGraphController: {}
  };

  disposeElement(element, (timer) => calls.push(`timer:${timer}`));

  assert.deepEqual(calls, [
    "timer:23",
    "resize",
    "theme",
    "pause",
    "destroy"
  ]);
  assert.equal(element.dataset.knowledgeGraphMounted, undefined);
  assert.equal(element.knowledgeGraphInstance, undefined);
  assert.equal(element.knowledgeGraphController, undefined);
});
