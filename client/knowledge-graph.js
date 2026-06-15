(function attachKnowledgeGraph(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.HexoKnowledgeGraph = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";

  function endpointId(endpoint) {
    return typeof endpoint === "object" && endpoint
      ? endpoint.id
      : endpoint;
  }

  function cloneNode(node, visitor) {
    return {
      ...node,
      visitor: Boolean(visitor)
    };
  }

  function cloneLink(link) {
    return {
      ...link,
      source: endpointId(link.source),
      target: endpointId(link.target)
    };
  }

  function selectGraphView(graph, selectedCategoryId) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const links = Array.isArray(graph?.links) ? graph.links : [];

    if (!selectedCategoryId) {
      return {
        nodes: nodes
          .filter((node) => node.type === "category")
          .map((node) => cloneNode(node, false)),
        links: []
      };
    }

    const category = nodes.find(
      (node) => node.type === "category" && node.id === selectedCategoryId
    );
    if (!category) return selectGraphView(graph, null);

    const membershipLinks = links
      .filter((link) => (
        link.type === "category"
        && endpointId(link.source) === selectedCategoryId
      ))
      .map(cloneLink);
    const memberIds = new Set(
      membershipLinks.map((link) => endpointId(link.target))
    );
    const referenceLinks = links
      .filter((link) => (
        link.type === "reference"
        && memberIds.has(endpointId(link.source))
      ))
      .map(cloneLink);
    const visitorIds = new Set(
      referenceLinks
        .map((link) => endpointId(link.target))
        .filter((id) => !memberIds.has(id))
    );

    const memberNodes = nodes
      .filter((node) => memberIds.has(node.id))
      .map((node) => cloneNode(node, false));
    const visitorNodes = nodes
      .filter((node) => visitorIds.has(node.id))
      .map((node) => cloneNode(node, true));

    return {
      nodes: [
        cloneNode(category, false),
        ...memberNodes,
        ...visitorNodes
      ],
      links: [
        ...membershipLinks,
        ...referenceLinks
      ]
    };
  }

  function createGraphController(options) {
    const graph = options?.graph || { nodes: [], links: [] };
    const setView = options?.setView || (() => {});
    const navigate = options?.navigate || (() => {});
    let selectedCategoryId = null;

    const render = () => {
      const view = selectGraphView(graph, selectedCategoryId);
      setView(view, selectedCategoryId);
      return view;
    };

    return {
      start() {
        return render();
      },
      getSelectedCategoryId() {
        return selectedCategoryId;
      },
      handleNodeClick(node) {
        if (node?.type === "category") {
          selectedCategoryId = selectedCategoryId === node.id ? null : node.id;
          return render();
        }
        if (node?.type === "post" && node.url) {
          navigate(node.url);
        }
        return null;
      },
      handleBackgroundClick() {
        if (selectedCategoryId == null) return null;
        selectedCategoryId = null;
        return render();
      },
      reset() {
        selectedCategoryId = null;
        return render();
      }
    };
  }

  function normalizePagePath(value) {
    let pathname = String(value || "/")
      .split(/[?#]/, 1)[0]
      .replaceAll("\\", "/")
      .replace(/\/index\.html?$/i, "/")
      .replace(/\/{2,}/g, "/");
    if (!pathname.startsWith("/")) pathname = `/${pathname}`;
    if (!pathname.endsWith("/")) pathname = `${pathname}/`;
    return pathname;
  }

  function shouldAutoMount(locationLike, options) {
    return Boolean(
      options?.autoMount
      && normalizePagePath(locationLike?.pathname) === normalizePagePath(
        options.categoriesPath
      )
    );
  }

  function linkLineDash(link) {
    return link?.type === "reference" ? [5, 7] : [];
  }

  function nodeValue(node) {
    if (node?.type === "category") return 90;
    return node?.visitor ? 18 : 28;
  }

  function scheduleZoomToFit(graphInstance, schedule = globalThis.setTimeout) {
    if (
      typeof graphInstance?.zoomToFit !== "function"
      || typeof schedule !== "function"
    ) {
      return null;
    }
    return schedule(() => graphInstance.zoomToFit(520, 48), 420);
  }

  function resolveLabelColors(element, getComputedStyleImpl) {
    const fallback = {
      default: "#3c4048",
      visitor: "#7f8791"
    };
    if (!element || typeof getComputedStyleImpl !== "function") {
      return fallback;
    }

    const color = getComputedStyleImpl(element)?.color;
    if (!color) return fallback;
    return {
      default: color,
      visitor: color
    };
  }

  function createAutoMountElement(documentRef, options) {
    const section = documentRef.createElement("section");
    section.id = "hexo-knowledge-graph-auto";
    section.className = "hexo-knowledge-graph";
    section.dataset.knowledgeGraph = "";
    section.dataset.dataUrl = options.dataUrl;
    section.dataset.title = options.title;
    section.style.setProperty(
      "--hexo-knowledge-graph-height",
      options.height || "620px"
    );

    const header = documentRef.createElement("div");
    header.className = "hexo-knowledge-graph__header";

    const title = documentRef.createElement("h2");
    title.className = "hexo-knowledge-graph__title";
    title.textContent = options.title || "Knowledge Graph";

    const reset = documentRef.createElement("button");
    reset.className = "hexo-knowledge-graph__reset";
    reset.type = "button";
    reset.hidden = true;
    reset.textContent = "返回分类总览";

    const canvas = documentRef.createElement("div");
    canvas.className = "hexo-knowledge-graph__canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", title.textContent);

    const status = documentRef.createElement("p");
    status.className = "hexo-knowledge-graph__status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "正在加载知识网络...";

    header.append(title, reset);
    section.append(header, canvas, status);
    return section;
  }

  function insertAutoMount(documentRef, options) {
    const existing = documentRef.getElementById("hexo-knowledge-graph-auto");
    if (existing) return existing;

    const target = documentRef.querySelector(options.targetSelector);
    if (!target) return null;

    const mount = createAutoMountElement(documentRef, options);
    const position = options.insertPosition || "beforebegin";
    if (typeof target.insertAdjacentElement === "function") {
      target.insertAdjacentElement(position, mount);
    } else if (position === "beforebegin" && target.parentNode) {
      target.parentNode.insertBefore(mount, target);
    } else if (target.parentNode) {
      target.parentNode.appendChild(mount);
    }
    return mount;
  }

  const graphDataCache = new Map();
  const mountedElements = new Set();

  async function loadGraphData(url, fetchImpl) {
    if (!graphDataCache.has(url)) {
      graphDataCache.set(url, Promise.resolve(fetchImpl(url)).then((response) => {
        if (!response.ok) {
          throw new Error(`Knowledge graph data request failed: ${response.status}`);
        }
        return response.json();
      }));
    }
    return graphDataCache.get(url);
  }

  function drawNodeLabel(node, context, globalScale, colors) {
    const label = String(node.name || "");
    if (!label) return;

    const fontSize = Math.max(3.5, 12 / globalScale);
    const radius = node.type === "category" ? 5.2 : 3.8;
    context.save();
    context.font = `600 ${fontSize}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.globalAlpha = node.visitor ? 0.72 : 0.92;
    context.fillStyle = node.visitor ? colors.visitor : colors.default;
    context.fillText(label, node.x, node.y + radius + (2 / globalScale));
    context.restore();
  }

  function referenceLabel(link) {
    if (link?.type !== "reference") return "";
    const labels = (link.references || [])
      .map((item) => item.label || item.anchor)
      .filter(Boolean);
    return labels.length ? `引用：${labels.join("、")}` : "文章引用";
  }

  function configureForces(graphInstance) {
    if (typeof graphInstance.d3Force !== "function") return;
    try {
      graphInstance.d3Force("charge")?.strength((node) => (
        node.type === "category" ? -280 : -95
      ));
      graphInstance.d3Force("link")?.distance((link) => (
        link.type === "category" ? 105 : 72
      ));
    } catch {
      // Custom force engines may not expose the d3 force methods.
    }
  }

  function disposeElement(element, clearSchedule = globalThis.clearTimeout) {
    if (!element) return;

    if (
      element.knowledgeGraphFitTimer != null
      && typeof clearSchedule === "function"
    ) {
      clearSchedule(element.knowledgeGraphFitTimer);
    }
    element.knowledgeGraphResizeObserver?.disconnect?.();
    element.knowledgeGraphThemeObserver?.disconnect?.();
    element.knowledgeGraphInstance?.pauseAnimation?.();
    element.knowledgeGraphInstance?._destructor?.();

    mountedElements.delete(element);
    delete element.knowledgeGraphFitTimer;
    delete element.knowledgeGraphResizeObserver;
    delete element.knowledgeGraphThemeObserver;
    delete element.knowledgeGraphController;
    delete element.knowledgeGraphInstance;
    delete element.dataset.knowledgeGraphMounted;
  }

  async function mountElement(element, options = {}) {
    if (!element || element.dataset.knowledgeGraphMounted === "true") {
      return element?.knowledgeGraphController || null;
    }

    const documentRef = options.document || globalThis.document;
    const windowRef = options.window || globalThis.window;
    const fetchImpl = options.fetch || globalThis.fetch;
    const forceGraphFactory = options.forceGraph || globalThis.ForceGraph;
    const canvas = element.querySelector(".hexo-knowledge-graph__canvas");
    const status = element.querySelector(".hexo-knowledge-graph__status");
    const reset = element.querySelector(".hexo-knowledge-graph__reset");
    const dataUrl = element.dataset.dataUrl || options.dataUrl;

    element.dataset.knowledgeGraphMounted = "loading";

    try {
      if (!canvas || !dataUrl || typeof fetchImpl !== "function") {
        throw new Error("Knowledge graph mount is missing its canvas or data URL");
      }
      if (typeof forceGraphFactory !== "function") {
        throw new Error("ForceGraph browser bundle is unavailable");
      }

      const data = await loadGraphData(dataUrl, fetchImpl);
      const getComputedStyleImpl = options.getComputedStyle
        || (
          typeof windowRef?.getComputedStyle === "function"
            ? windowRef.getComputedStyle.bind(windowRef)
            : globalThis.getComputedStyle
        );
      let labelColors = resolveLabelColors(element, getComputedStyleImpl);
      const colors = {
        category: "#786395",
        post: "#e3ae63",
        visitor: "#d7dbe1",
        categoryLink: "rgba(120, 99, 149, 0.72)",
        referenceLink: "rgba(150, 158, 170, 0.42)",
        ...(options.colors || {})
      };
      let fitPending = true;
      let fitTimer = null;
      const clearSchedule = options.clearSchedule || globalThis.clearTimeout;
      const graphInstance = forceGraphFactory()(canvas)
        .width(canvas.clientWidth)
        .height(canvas.clientHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .nodeId("id")
        .nodeLabel((node) => node.name)
        .nodeVal(nodeValue)
        .nodeColor((node) => (
          node.type === "category"
            ? colors.category
            : (node.visitor ? colors.visitor : colors.post)
        ))
        .nodeCanvasObjectMode(() => "after")
        .nodeCanvasObject((node, context, globalScale) => {
          drawNodeLabel(node, context, globalScale, labelColors);
        })
        .linkColor((link) => (
          link.type === "reference"
            ? colors.referenceLink
            : colors.categoryLink
        ))
        .linkWidth((link) => link.type === "reference" ? 1 : 1.6)
        .linkLineDash(linkLineDash)
        .linkLabel(referenceLabel)
        .enableNodeDrag(true)
        .onEngineStop(() => {
          if (fitPending && typeof graphInstance.zoomToFit === "function") {
            fitPending = false;
            if (fitTimer != null && typeof clearSchedule === "function") {
              clearSchedule(fitTimer);
              fitTimer = null;
              element.knowledgeGraphFitTimer = null;
            }
            graphInstance.zoomToFit(520, 48);
          }
        });

      configureForces(graphInstance);

      const controller = createGraphController({
        graph: data,
        setView(view, selectedCategoryId) {
          fitPending = true;
          if (fitTimer != null && typeof clearSchedule === "function") {
            clearSchedule(fitTimer);
          }
          graphInstance.graphData(view);
          if (typeof graphInstance.d3ReheatSimulation === "function") {
            graphInstance.d3ReheatSimulation();
          }
          fitTimer = scheduleZoomToFit(
            graphInstance,
            options.schedule || globalThis.setTimeout
          );
          element.knowledgeGraphFitTimer = fitTimer;
          if (reset) reset.hidden = selectedCategoryId == null;
        },
        navigate(url) {
          windowRef.location.href = url;
        }
      });

      graphInstance
        .onNodeClick((node) => controller.handleNodeClick(node))
        .onBackgroundClick(() => controller.handleBackgroundClick());

      if (reset) {
        reset.addEventListener("click", () => controller.reset());
      }

      if (typeof globalThis.ResizeObserver === "function") {
        const observer = new globalThis.ResizeObserver(() => {
          graphInstance
            .width(canvas.clientWidth)
            .height(canvas.clientHeight);
        });
        observer.observe(canvas);
        element.knowledgeGraphResizeObserver = observer;
      }

      const MutationObserverImpl = options.MutationObserver
        || windowRef?.MutationObserver
        || globalThis.MutationObserver;
      if (
        typeof MutationObserverImpl === "function"
        && documentRef?.documentElement
      ) {
        const observer = new MutationObserverImpl(() => {
          labelColors = resolveLabelColors(element, getComputedStyleImpl);
          if (typeof graphInstance.refresh === "function") {
            graphInstance.refresh();
          }
        });
        observer.observe(documentRef.documentElement, {
          attributes: true,
          attributeFilter: ["class", "data-theme", "style"]
        });
        element.knowledgeGraphThemeObserver = observer;
      }

      controller.start();
      element.knowledgeGraphController = controller;
      element.knowledgeGraphInstance = graphInstance;
      element.dataset.knowledgeGraphMounted = "true";
      element.classList.add("is-ready");
      mountedElements.add(element);
      if (status) status.textContent = "";
      return controller;
    } catch (error) {
      element.dataset.knowledgeGraphMounted = "error";
      element.classList.add("is-error");
      if (status) {
        status.textContent = `知识网络加载失败：${error.message}`;
      }
      return null;
    }
  }

  async function boot(options = {}) {
    const documentRef = options.document || globalThis.document;
    const locationRef = options.location || globalThis.location;
    if (!documentRef) return [];

    for (const element of Array.from(mountedElements)) {
      if (element.isConnected === false) {
        disposeElement(element, options.clearSchedule || globalThis.clearTimeout);
      }
    }

    const existingAutoMount = documentRef.getElementById(
      "hexo-knowledge-graph-auto"
    );
    if (shouldAutoMount(locationRef, options)) {
      insertAutoMount(documentRef, options);
    } else if (existingAutoMount) {
      disposeElement(
        existingAutoMount,
        options.clearSchedule || globalThis.clearTimeout
      );
      existingAutoMount.remove();
    }

    const mounts = Array.from(
      documentRef.querySelectorAll("[data-knowledge-graph]")
    );
    return Promise.all(mounts.map((element) => mountElement(element, {
      ...options,
      document: documentRef
    })));
  }

  return {
    boot,
    createGraphController,
    createAutoMountElement,
    disposeElement,
    endpointId,
    insertAutoMount,
    linkLineDash,
    loadGraphData,
    mountElement,
    nodeValue,
    normalizePagePath,
    resolveLabelColors,
    scheduleZoomToFit,
    shouldAutoMount,
    selectGraphView
  };
});
