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

  // ── Obsidian-inspired palette ──────────────────────────────────

  var CLUSTER_COLORS = {
    ai: "#7aa2f7",
    cs: "#41a6b5",
    math: "#bb9af7",
    reading: "#e0af68",
    industry: "#f7768e",
    default: "#7a8294"
  };

  var LINK_COLOR = "rgba(160, 160, 180, 0.16)";
  var LINK_HIGHLIGHT_COLOR = "rgba(120, 170, 255, 0.50)";
  var LINK_DIMMED_COLOR = "rgba(160, 160, 180, 0.04)";

  var NODE_DIMMED_ALPHA = 0.10;
  var LABEL_COLOR = "#a8a8b8";
  var LABEL_COLOR_DIM = "#5a5a6e";

  // ── Utilities ──────────────────────────────────────────────────

  function endpointId(endpoint) {
    return typeof endpoint === "object" && endpoint
      ? endpoint.id
      : endpoint;
  }

  function colorWithAlpha(color, alpha) {
    if (typeof color !== "string") return color;
    if (color.startsWith("rgba")) {
      return color.replace(/,\s*[\d.]+\)$/, ", " + alpha + ")");
    }
    if (color.startsWith("rgb(")) {
      return color.replace("rgb(", "rgba(").replace(")", ", " + alpha + ")");
    }
    if (color.startsWith("#")) {
      var hex = color.length === 4
        ? color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
        : color.slice(1);
      var r = parseInt(hex.slice(0, 2), 16);
      var g = parseInt(hex.slice(2, 4), 16);
      var b = parseInt(hex.slice(4, 6), 16);
      return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }
    return color;
  }

  function cloneNode(node, visitor) {
    return { ...node, visitor: Boolean(visitor) };
  }

  function cloneLink(link) {
    return {
      ...link,
      source: endpointId(link.source),
      target: endpointId(link.target)
    };
  }

  function annotateRefCounts(view) {
    var counts = new Map();
    for (var i = 0; i < view.links.length; i++) {
      var link = view.links[i];
      if (link.type === "reference") {
        var targetId = endpointId(link.target);
        counts.set(targetId, (counts.get(targetId) || 0) + 1);
      }
    }
    for (var j = 0; j < view.nodes.length; j++) {
      var node = view.nodes[j];
      if (node.type === "post") {
        node.refCount = counts.get(node.id) || 0;
      }
    }
    return view;
  }

  function selectGraphView(graph, selectedCategoryId) {
    var nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    var links = Array.isArray(graph.links) ? graph.links : [];

    if (!selectedCategoryId) {
      return annotateRefCounts({
        nodes: nodes
          .filter(function (node) { return node.type === "category" || node.type === "topic"; })
          .map(function (node) { return cloneNode(node, false); }),
        links: links.filter(function (link) { return link.type === "topic"; })
      });
    }

    var category = null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].type === "category" && nodes[i].id === selectedCategoryId) {
        category = nodes[i];
        break;
      }
    }
    if (!category) return selectGraphView(graph, null);

    var membershipLinks = links.filter(function (link) {
      return link.type === "category"
        && endpointId(link.source) === selectedCategoryId;
    }).map(cloneLink);
    var memberIds = new Set();
    for (var j = 0; j < membershipLinks.length; j++) {
      memberIds.add(endpointId(membershipLinks[j].target));
    }
    var referenceLinks = links.filter(function (link) {
      return link.type === "reference"
        && memberIds.has(endpointId(link.source));
    }).map(cloneLink);
    var visitorIds = new Set();
    for (var k = 0; k < referenceLinks.length; k++) {
      var rid = endpointId(referenceLinks[k].target);
      if (!memberIds.has(rid)) visitorIds.add(rid);
    }

    var memberNodes = nodes
      .filter(function (node) { return memberIds.has(node.id); })
      .map(function (node) { return cloneNode(node, false); });
    var visitorNodes = nodes
      .filter(function (node) { return visitorIds.has(node.id); })
      .map(function (node) { return cloneNode(node, true); });

    return annotateRefCounts({
      nodes: [cloneNode(category, false)].concat(memberNodes, visitorNodes),
      links: membershipLinks.concat(referenceLinks)
    });
  }

  // ── Graph view controller ─────────────────────────────────────

  function createGraphController(options) {
    var graph = options.graph || { nodes: [], links: [] };
    var setView = options.setView || function () {};
    var navigate = options.navigate || function () {};
    var selectedCategoryId = null;

    function render() {
      var view = selectGraphView(graph, selectedCategoryId);
      setView(view, selectedCategoryId);
      return view;
    }

    return {
      start: function () { return render(); },
      getSelectedCategoryId: function () { return selectedCategoryId; },
      handleNodeClick: function (node) {
        if (node.type === "category") {
          selectedCategoryId = selectedCategoryId === node.id ? null : node.id;
          return render();
        }
        if (node.type === "post" && node.url) {
          navigate(node.url);
        }
        return null;
      },
      handleBackgroundClick: function () {
        if (selectedCategoryId == null) return null;
        selectedCategoryId = null;
        return render();
      },
      reset: function () {
        selectedCategoryId = null;
        return render();
      }
    };
  }

  // ── Path normalization ────────────────────────────────────────

  function normalizePagePath(value) {
    var pathname = String(value || "/")
      .split(/[?#]/, 1)[0]
      .replaceAll("\\", "/")
      .replace(/\/index\.html?$/i, "/")
      .replace(/\/{2,}/g, "/");
    if (!pathname.startsWith("/")) pathname = "/" + pathname;
    if (!pathname.endsWith("/")) pathname = pathname + "/";
    return pathname;
  }

  function shouldAutoMount(locationLike, options) {
    return Boolean(
      options
      && options.autoMount
      && normalizePagePath(locationLike && locationLike.pathname) === normalizePagePath(
        options.categoriesPath
      )
    );
  }

  function linkLineDash(link) {
    return link && link.type === "reference" ? [5, 7] : [];
  }

  // ── Node sizing — Obsidian: small dots ───────────────────────

  function resolveNodeRadius(node) {
    if (node.type === "topic") return (node.size || 6) * 0.6;
    if (node.type === "category") return 7;
    var base = node.visitor ? 3 : 4.5;
    var refBonus = Math.min((node.refCount || 0) * 0.8, 3.5);
    return base + refBonus;
  }

  function nodeValue(node) {
    // Return area-equivalent value for force-graph charge/link-distance calculations
    var r = resolveNodeRadius(node);
    return r;
  }

  // ── Node color resolution ─────────────────────────────────────

  function resolveNodeColor(node, state) {
    var hoveredNode = state.hoveredNode;
    var selectedNode = state.selectedNode;
    var connectedNodeIds = state.connectedNodeIds;

    if (selectedNode === node.id) return "#8ab4f8";
    if (hoveredNode === node.id) return "#9cc4ff";

    var isDimmed = hoveredNode && node.id !== hoveredNode && !connectedNodeIds.has(node.id);

    if (node.type === "topic") {
      var clusterColor = CLUSTER_COLORS[node.cluster] || CLUSTER_COLORS.default;
      return isDimmed ? colorWithAlpha(clusterColor, 0.12) : colorWithAlpha(clusterColor, 0.70);
    }
    if (node.type === "category") {
      return isDimmed ? colorWithAlpha("#8899aa", 0.12) : "#8899aa";
    }
    if (node.visitor) {
      return isDimmed ? colorWithAlpha("#5a5d6e", 0.08) : "#5a5d6e";
    }
    return isDimmed ? colorWithAlpha("#6e7385", 0.10) : "#6e7385";
  }

  // ── Canvas rendering: Obsidian-style nodes ────────────────────

  function drawObsidianNode(node, ctx, globalScale, state) {
    var radius = resolveNodeRadius(node);
    var isHovered = state.hoveredNode === node.id;
    var isSelected = state.selectedNode === node.id;
    var isNeighbor = state.connectedNodeIds.has(node.id);
    var isDimmed = state.hoveredNode && !isHovered && !isNeighbor;
    var showLabel = state.labelMode === "all"
      || (state.labelMode === "important" && (node.type === "topic" || node.type === "category"))
      || isHovered
      || isSelected;

    if (isDimmed) {
      ctx.globalAlpha = 0.18;
    }

    // Glow ring for hovered, selected, or important topic nodes
    if (isHovered || isSelected || (node.type === "topic" && node.layer === "core")) {
      var glowRadius = radius * (isHovered || isSelected ? 2.8 : 1.8);
      var glowAlpha = isHovered || isSelected ? 0.28 : 0.10;
      var glowColor = node.type === "topic"
        ? (CLUSTER_COLORS[node.cluster] || CLUSTER_COLORS.default)
        : "#8ab4f8";

      var glow = ctx.createRadialGradient(node.x, node.y, radius * 0.3, node.x, node.y, glowRadius);
      glow.addColorStop(0, colorWithAlpha(glowColor, glowAlpha));
      glow.addColorStop(1, colorWithAlpha(glowColor, 0));
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Main dot
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = resolveNodeColor(node, state);

    // Subtle ring for important nodes
    if (node.type === "topic" && node.layer === "core" && !isHovered && !isSelected) {
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 1.2, 0, 2 * Math.PI);
      ctx.strokeStyle = colorWithAlpha(
        CLUSTER_COLORS[node.cluster] || CLUSTER_COLORS.default,
        0.30
      );
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else {
      ctx.fill();
    }

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 2.5, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(138, 180, 248, 0.55)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    // Neighbor ring
    if (isNeighbor && !isHovered && !isSelected && state.hoveredNode) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 1.5, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(138, 180, 248, 0.22)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // Label — positioned to the right of the node
    if (showLabel) {
      var label = String(node.name || "");
      var fontSize = Math.max(4, (node.type === "topic" && node.layer === "core") ? 12 / globalScale : 11 / globalScale);
      var fontWeight = (node.type === "topic" && node.layer === "core") ? "520" : "400";
      var labelX = node.x + radius + 5 / globalScale;
      var labelY = node.y + fontSize * 0.35;

      if (label) {
        ctx.save();
        ctx.font = fontWeight + " " + fontSize + "px \"Helvetica Neue\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isDimmed ? LABEL_COLOR_DIM : (
          isHovered || isSelected ? "#d0d0e8" : LABEL_COLOR
        );
        ctx.globalAlpha = isDimmed ? 0.25 : (isHovered || isSelected ? 0.95 : (
          node.type === "topic" ? 0.82 : 0.60
        ));
        ctx.fillText(label, labelX, labelY);
        ctx.restore();
      }
    }

    ctx.globalAlpha = 1;
  }

  // ── Link color resolution ──────────────────────────────────────

  function resolveLinkColor(link, state) {
    var hoveredNode = state.hoveredNode;
    if (!hoveredNode) return LINK_COLOR;

    var srcId = endpointId(link.source);
    var tgtId = endpointId(link.target);
    if (srcId === hoveredNode || tgtId === hoveredNode) {
      return LINK_HIGHLIGHT_COLOR;
    }
    return LINK_DIMMED_COLOR;
  }

  function resolveLinkWidth(link, state) {
    var base = link.weight ? Math.max(0.4, link.weight * 0.5) : 0.6;
    var hoveredNode = state.hoveredNode;
    if (!hoveredNode) return base;

    var srcId = endpointId(link.source);
    var tgtId = endpointId(link.target);
    if (srcId === hoveredNode || tgtId === hoveredNode) {
      return Math.min(base * 2.2, 1.8);
    }
    return base * 0.5;
  }

  // ── Schedule helpers ──────────────────────────────────────────

  function scheduleZoomToFit(graphInstance, schedule) {
    if (
      typeof graphInstance.zoomToFit !== "function"
      || typeof schedule !== "function"
    ) {
      return null;
    }
    return schedule(function () { graphInstance.zoomToFit(520, 48); }, 420);
  }

  // ── Label colors (CSS-driven) ─────────────────────────────────

  function resolveLabelColors(element, getComputedStyleImpl) {
    var fallback = {
      default: "#a8a8b8",
      visitor: "#5a5a6e"
    };
    if (!element || typeof getComputedStyleImpl !== "function") {
      return fallback;
    }
    var color = getComputedStyleImpl(element).color;
    if (!color) return fallback;
    return { default: color, visitor: color };
  }

  function resolveGraphColors(element, getComputedStyleImpl, baseColors) {
    if (!element || typeof getComputedStyleImpl !== "function") {
      return baseColors;
    }
    var html = element.ownerDocument && element.ownerDocument.documentElement;
    if (!html) return baseColors;

    var isDark = html.matches("[data-theme='dark'], .dark, :root[data-theme='dark']");
    if (!isDark) return baseColors;

    return {
      category: "#8899aa",
      post: "#6e7385",
      visitor: "#4a4d5e",
      categoryLink: LINK_COLOR,
      referenceLink: LINK_COLOR,
      topic: CLUSTER_COLORS.default
    };
  }

  // ── Auto-mount DOM construction ───────────────────────────────

  function createAutoMountElement(documentRef, options) {
    var section = documentRef.createElement("section");
    section.id = "hexo-knowledge-graph-auto";
    section.className = "hexo-knowledge-graph";
    section.dataset.knowledgeGraph = "";
    section.dataset.dataUrl = options.dataUrl;
    section.dataset.title = options.title;
    section.style.setProperty(
      "--hexo-knowledge-graph-height",
      options.height || "620px"
    );

    var header = documentRef.createElement("div");
    header.className = "hexo-knowledge-graph__header";

    var title = documentRef.createElement("h2");
    title.className = "hexo-knowledge-graph__title";
    title.textContent = options.title || "知识网络";

    var headerActions = documentRef.createElement("div");
    headerActions.className = "hexo-knowledge-graph__header-actions";

    var expandBtn = documentRef.createElement("button");
    expandBtn.className = "hexo-knowledge-graph__expand-btn";
    expandBtn.type = "button";
    expandBtn.hidden = true;
    expandBtn.textContent = "展开知识网络";

    var resetBtn = documentRef.createElement("button");
    resetBtn.className = "hexo-knowledge-graph__reset";
    resetBtn.type = "button";
    resetBtn.hidden = true;
    resetBtn.textContent = "返回总览";

    headerActions.append(expandBtn, resetBtn);
    header.append(title, headerActions);

    // Canvas wrapper
    var canvasWrap = documentRef.createElement("div");
    canvasWrap.className = "hexo-knowledge-graph__canvas-wrap";

    // Search
    var search = documentRef.createElement("div");
    search.className = "hexo-knowledge-graph__search";
    var searchInput = documentRef.createElement("input");
    searchInput.className = "hexo-knowledge-graph__search-input";
    searchInput.type = "text";
    searchInput.placeholder = "搜索节点...";
    searchInput.autocomplete = "off";
    var searchDropdown = documentRef.createElement("div");
    searchDropdown.className = "hexo-knowledge-graph__search-dropdown";
    search.append(searchInput, searchDropdown);

    // Toolbar
    var toolbar = documentRef.createElement("div");
    toolbar.className = "hexo-knowledge-graph__toolbar";
    var toolbarButtons = [
      { action: "search", title: "搜索", svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>' },
      { action: "reset", title: "重置视图", svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>' },
      { divider: true },
      { action: "toggle-labels", title: "切换标签", svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h4M7 12h6M7 16h3"/></svg>' },
      { action: "toggle-layout", title: "切换布局", svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/></svg>' }
    ];
    for (var i = 0; i < toolbarButtons.length; i++) {
      var def = toolbarButtons[i];
      if (def.divider) {
        var div = documentRef.createElement("div");
        div.className = "hexo-knowledge-graph__toolbar-divider";
        toolbar.appendChild(div);
      } else {
        var btn = documentRef.createElement("button");
        btn.className = "hexo-knowledge-graph__toolbar-btn";
        btn.dataset.action = def.action;
        btn.title = def.title;
        btn.setAttribute("aria-label", def.title);
        btn.innerHTML = def.svg;
        toolbar.appendChild(btn);
      }
    }

    // Detail panel
    var detail = documentRef.createElement("div");
    detail.className = "hexo-knowledge-graph__detail";
    var detailClose = documentRef.createElement("button");
    detailClose.className = "hexo-knowledge-graph__detail-close";
    detailClose.type = "button";
    detailClose.setAttribute("aria-label", "关闭详情");
    detailClose.innerHTML = "&times;";
    var detailTitle = documentRef.createElement("div");
    detailTitle.className = "hexo-knowledge-graph__detail-title";
    var detailStats = documentRef.createElement("div");
    detailStats.className = "hexo-knowledge-graph__detail-stats";
    detail.append(detailClose, detailTitle, detailStats);

    // Legend
    var legend = documentRef.createElement("div");
    legend.className = "hexo-knowledge-graph__legend";
    var clusterLabels = [
      { id: "ai", label: "AI/ML" },
      { id: "cs", label: "CS基础" },
      { id: "math", label: "数学" },
      { id: "reading", label: "阅读" },
      { id: "industry", label: "工业" }
    ];
    for (var j = 0; j < clusterLabels.length; j++) {
      var item = documentRef.createElement("span");
      item.className = "hexo-knowledge-graph__legend-item";
      var dot = documentRef.createElement("span");
      dot.className = "hexo-knowledge-graph__legend-dot";
      dot.style.backgroundColor = CLUSTER_COLORS[clusterLabels[j].id] || CLUSTER_COLORS.default;
      var labelSpan = documentRef.createElement("span");
      labelSpan.textContent = clusterLabels[j].label;
      item.append(dot, labelSpan);
      legend.appendChild(item);
    }

    var canvas = documentRef.createElement("div");
    canvas.className = "hexo-knowledge-graph__canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", title.textContent);

    canvasWrap.append(search, toolbar, detail, legend, canvas);

    var status = documentRef.createElement("p");
    status.className = "hexo-knowledge-graph__status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "正在加载知识网络...";

    section.append(header, canvasWrap, status);
    return section;
  }

  function insertAutoMount(documentRef, options) {
    var existing = documentRef.getElementById("hexo-knowledge-graph-auto");
    if (existing) return existing;

    var target = documentRef.querySelector(options.targetSelector);
    if (!target) return null;

    var mount = createAutoMountElement(documentRef, options);
    var position = options.insertPosition || "beforebegin";
    if (typeof target.insertAdjacentElement === "function") {
      target.insertAdjacentElement(position, mount);
    } else if (position === "beforebegin" && target.parentNode) {
      target.parentNode.insertBefore(mount, target);
    } else if (target.parentNode) {
      target.parentNode.appendChild(mount);
    }
    return mount;
  }

  // ── Data loading ──────────────────────────────────────────────

  var graphDataCache = new Map();
  var mountedElements = new Set();

  function loadGraphData(url, fetchImpl) {
    if (!graphDataCache.has(url)) {
      graphDataCache.set(url, Promise.resolve(fetchImpl(url)).then(function (response) {
        if (!response.ok) {
          throw new Error("Knowledge graph data request failed: " + response.status);
        }
        return response.json();
      }));
    }
    return graphDataCache.get(url);
  }

  // ── Detail panel ──────────────────────────────────────────────

  function showDetailPanel(element, node, graphData) {
    var detail = element.querySelector(".hexo-knowledge-graph__detail");
    var title = element.querySelector(".hexo-knowledge-graph__detail-title");
    var stats = element.querySelector(".hexo-knowledge-graph__detail-stats");
    if (!detail || !title || !stats) return;

    title.textContent = node.name || node.id;

    var neighborCount = 0;
    var graphLinks = graphData && graphData.links ? graphData.links : [];
    for (var i = 0; i < graphLinks.length; i++) {
      var link = graphLinks[i];
      if (endpointId(link.source) === node.id || endpointId(link.target) === node.id) {
        neighborCount++;
      }
    }

    var clusterName = "";
    if (node.cluster) {
      var clusterLabels = { ai: "AI / ML", cs: "CS 基础", math: "数学", reading: "Reading", industry: "工业应用" };
      clusterName = clusterLabels[node.cluster] || node.cluster;
    }

    var statsHtml = "";
    if (clusterName) {
      statsHtml += '<div class="hexo-knowledge-graph__detail-stat"><span>知识簇</span><span>' + clusterName + '</span></div>';
    }
    if (node.type) {
      var typeLabel = { topic: "主题节点", category: "分类", post: "文章" };
      statsHtml += '<div class="hexo-knowledge-graph__detail-stat"><span>类型</span><span>' + (typeLabel[node.type] || node.type) + '</span></div>';
    }
    statsHtml += '<div class="hexo-knowledge-graph__detail-stat"><span>关联节点</span><span>' + neighborCount + '</span></div>';
    if (node.refCount) {
      statsHtml += '<div class="hexo-knowledge-graph__detail-stat"><span>被引用</span><span>' + node.refCount + ' 次</span></div>';
    }

    stats.innerHTML = statsHtml;
    detail.classList.add("is-visible");
  }

  function hideDetailPanel(element) {
    var detail = element.querySelector(".hexo-knowledge-graph__detail");
    if (detail) detail.classList.remove("is-visible");
  }

  // ── Search ────────────────────────────────────────────────────

  function buildSearchIndex(nodes) {
    var index = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var name = (node.name || "").toLowerCase();
      var id = (node.id || "").toLowerCase();
      if (name || id) {
        index.push({ node: node, name: name, id: id });
      }
    }
    return index;
  }

  function searchNodes(query, index) {
    if (!query || query.length < 1) return [];
    var q = query.toLowerCase();
    var results = [];
    for (var i = 0; i < index.length; i++) {
      if (results.length >= 8) break;
      if (index[i].name.includes(q) || index[i].id.includes(q)) {
        results.push(index[i].node);
      }
    }
    return results;
  }

  // ── Filter graph data for compact / expanded view ─────────────

  function filterGraphForView(graphData, expanded) {
    if (expanded) return graphData;
    var nodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
    var links = Array.isArray(graphData.links) ? graphData.links : [];

    // In compact mode, show only core layer nodes + category nodes + topic→topic links + category-topic links
    var visibleNodeIds = new Set();
    var filteredNodes = [];

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.layer === "core" || node.type === "category") {
        visibleNodeIds.add(node.id);
        filteredNodes.push(node);
      }
    }

    // Also include topic nodes directly connected to visible nodes
    for (var j = 0; j < nodes.length; j++) {
      if (!visibleNodeIds.has(nodes[j].id) && nodes[j].type === "topic" && nodes[j].size >= 7) {
        visibleNodeIds.add(nodes[j].id);
        filteredNodes.push(nodes[j]);
      }
    }

    var filteredLinks = [];
    for (var k = 0; k < links.length; k++) {
      var link = links[k];
      var srcId = endpointId(link.source);
      var tgtId = endpointId(link.target);
      if (visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId)) {
        filteredLinks.push(link);
      }
    }

    return { nodes: filteredNodes, links: filteredLinks, meta: graphData.meta };
  }

  // ── Force configuration ───────────────────────────────────────

  function configureForces(graphInstance) {
    if (typeof graphInstance.d3Force !== "function") return;
    try {
      var charge = graphInstance.d3Force("charge");
      if (charge) {
        charge.strength(function (node) {
          if (node.type === "topic" && node.layer === "core") return -280;
          if (node.type === "topic") return -180;
          if (node.type === "category") return -160;
          return -90;
        });
      }
      var linkForce = graphInstance.d3Force("link");
      if (linkForce) {
        linkForce.distance(function (link) {
          if (link.type === "topic") return 55;
          if (link.type === "category-topic" || link.type === "post-topic") return 80;
          if (link.type === "category") return 70;
          return 65;
        });
      }
      var center = graphInstance.d3Force("center");
      if (center) {
        center.strength(0.03);
      }
      var collide = graphInstance.d3Force("collide");
      if (!collide && typeof graphInstance.d3Force === "function") {
        // Add a subtle collision force to prevent node overlap
        try {
          var d3 = (globalThis.d3 || (typeof require === "function" ? require("d3") : null));
          if (d3) {
            graphInstance.d3Force("collide", d3.forceCollide().radius(function (node) {
              return resolveNodeRadius(node) + 6;
            }).strength(0.3));
          }
        } catch (e) {
          // collision force is optional
        }
      }
    } catch (e) {
      // Custom force engines may not expose d3 force methods
    }
  }

  // ── Element disposal ──────────────────────────────────────────

  function disposeElement(element, clearSchedule) {
    if (!element) return;

    if (
      element.knowledgeGraphFitTimer != null
      && typeof clearSchedule === "function"
    ) {
      clearSchedule(element.knowledgeGraphFitTimer);
    }
    element.knowledgeGraphResizeObserver && element.knowledgeGraphResizeObserver.disconnect();
    element.knowledgeGraphThemeObserver && element.knowledgeGraphThemeObserver.disconnect();
    element.knowledgeGraphInstance && element.knowledgeGraphInstance.pauseAnimation();
    element.knowledgeGraphInstance && element.knowledgeGraphInstance._destructor();

    mountedElements.delete(element);
    delete element.knowledgeGraphFitTimer;
    delete element.knowledgeGraphResizeObserver;
    delete element.knowledgeGraphThemeObserver;
    delete element.knowledgeGraphController;
    delete element.knowledgeGraphInstance;
    delete element.dataset.knowledgeGraphMounted;
  }

  // ── Main mount logic ──────────────────────────────────────────

  function mountElement(element, options) {
    if (!element || element.dataset.knowledgeGraphMounted === "true") {
      return element && element.knowledgeGraphController ? element.knowledgeGraphController : null;
    }

    var documentRef = options.document || globalThis.document;
    var windowRef = options.window || globalThis.window;
    var fetchImpl = options.fetch || globalThis.fetch;
    var forceGraphFactory = options.forceGraph || globalThis.ForceGraph;
    var canvas = element.querySelector(".hexo-knowledge-graph__canvas");
    var canvasWrap = element.querySelector(".hexo-knowledge-graph__canvas-wrap");
    var status = element.querySelector(".hexo-knowledge-graph__status");
    var resetBtn = element.querySelector(".hexo-knowledge-graph__reset");
    var expandBtn = element.querySelector(".hexo-knowledge-graph__expand-btn");
    var dataUrl = element.dataset.dataUrl || options.dataUrl;

    element.dataset.knowledgeGraphMounted = "loading";

    try {
      if (!canvas || !dataUrl || typeof fetchImpl !== "function") {
        throw new Error("Knowledge graph mount is missing its canvas or data URL");
      }
      if (typeof forceGraphFactory !== "function") {
        throw new Error("ForceGraph browser bundle is unavailable");
      }

      // ── State ──────────────────────────────────────────────────
      var fullGraphData = null;
      var expanded = false;
      var hoveredNode = null;
      var selectedNode = null;
      var connectedNodeIds = new Set();
      var labelMode = "important"; // "important" | "all" | "hover"
      var layoutMode = "force"; // "force" | "cluster"
      var fitPending = true;
      var fitTimer = null;
      var searchIndex = [];
      var currentViewNodes = [];

      var clearSchedule = options.clearSchedule || globalThis.clearTimeout;

      // ── Build render state ─────────────────────────────────────
      function buildRenderState() {
        return {
          hoveredNode: hoveredNode,
          selectedNode: selectedNode ? selectedNode.id : null,
          connectedNodeIds: connectedNodeIds,
          labelMode: labelMode,
          layoutMode: layoutMode
        };
      }

      // ── ForceGraph factory ─────────────────────────────────────
      var graphInstance = forceGraphFactory()(canvas)
        .width(canvas.clientWidth)
        .height(canvas.clientHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .nodeId("id")
        .nodeLabel(function (node) { return node.name; })
        .nodeVal(function (node) { return resolveNodeRadius(node); })
        .nodeColor(function (node) {
          return resolveNodeColor(node, buildRenderState());
        })
        .nodeCanvasObjectMode(function () { return "replace"; })
        .nodeCanvasObject(function (node, ctx, globalScale) {
          drawObsidianNode(node, ctx, globalScale, buildRenderState());
        })
        .linkColor(function (link) {
          return resolveLinkColor(link, buildRenderState());
        })
        .linkWidth(function (link) {
          return resolveLinkWidth(link, buildRenderState());
        })
        .linkLineDash(function (link) {
          return link && (link.type === "reference" || link.dashed) ? [5, 7] : [];
        })
        .linkDirectionalArrowLength(function (link) { return 0; })
        .enableNodeDrag(true)
        .onEngineStop(function () {
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

      // ── Update graph data in ForceGraph ────────────────────────
      function applyGraphData() {
        fitPending = true;
        if (fitTimer != null && typeof clearSchedule === "function") {
          clearSchedule(fitTimer);
        }
        var dataToRender = filterGraphForView(fullGraphData, expanded);
        graphInstance.graphData(dataToRender);
        currentViewNodes = (dataToRender && dataToRender.nodes) || [];
        searchIndex = buildSearchIndex(currentViewNodes);

        if (typeof graphInstance.d3ReheatSimulation === "function") {
          graphInstance.d3ReheatSimulation();
        }
        fitTimer = scheduleZoomToFit(graphInstance, options.schedule || globalThis.setTimeout);
        element.knowledgeGraphFitTimer = fitTimer;
      }

      // ── Find connected nodes ───────────────────────────────────
      function updateConnectedNodes(nodeId) {
        connectedNodeIds = new Set();
        if (!nodeId || !fullGraphData) return;
        var links = Array.isArray(fullGraphData.links) ? fullGraphData.links : [];
        for (var i = 0; i < links.length; i++) {
          var link = links[i];
          var srcId = endpointId(link.source);
          var tgtId = endpointId(link.target);
          if (srcId === nodeId) connectedNodeIds.add(tgtId);
          if (tgtId === nodeId) connectedNodeIds.add(srcId);
        }
      }

      // ── Refresh ForceGraph display ─────────────────────────────
      function refreshDisplay() {
        if (typeof graphInstance.refresh === "function") {
          graphInstance.refresh();
        }
      }

      // ── Event handlers ─────────────────────────────────────────

      // Node click
      graphInstance.onNodeClick(function (node) {
        if (node.type === "post" && node.url) {
          windowRef.location.href = node.url;
          return;
        }
        if (selectedNode && selectedNode.id === node.id) {
          // Deselect
          selectedNode = null;
          hideDetailPanel(element);
        } else {
          selectedNode = node;
          showDetailPanel(element, node, fullGraphData);
        }
        updateConnectedNodes(selectedNode ? selectedNode.id : null);
        refreshDisplay();
      });

      // Background click
      graphInstance.onBackgroundClick(function () {
        if (selectedNode) {
          selectedNode = null;
          hideDetailPanel(element);
          updateConnectedNodes(null);
          refreshDisplay();
        }
      });

      // Node hover
      graphInstance.onNodeHover(function (node) {
        if (node) {
          hoveredNode = node.id;
          updateConnectedNodes(node.id);
        } else {
          hoveredNode = null;
          updateConnectedNodes(null);
        }
        refreshDisplay();
      });

      // ── Toolbar handlers ───────────────────────────────────────

      // Search button
      var searchEl = element.querySelector(".hexo-knowledge-graph__search");
      var searchInput = searchEl && searchEl.querySelector(".hexo-knowledge-graph__search-input");
      var searchDropdown = searchEl && searchEl.querySelector(".hexo-knowledge-graph__search-dropdown");

      var toolbarBtns = element.querySelectorAll(".hexo-knowledge-graph__toolbar-btn");
      for (var ti = 0; ti < toolbarBtns.length; ti++) {
        toolbarBtns[ti].addEventListener("click", function (e) {
          var action = this.dataset.action;

          if (action === "search") {
            // Toggle search visibility
            if (searchEl) {
              var isVisible = searchEl.style.display !== "none";
              searchEl.style.display = isVisible ? "none" : "";
              if (!isVisible && searchInput) searchInput.focus();
            }
          } else if (action === "reset") {
            // Reset zoom/pan
            selectedNode = null;
            hoveredNode = null;
            updateConnectedNodes(null);
            hideDetailPanel(element);
            fitPending = true;
            if (typeof graphInstance.zoomToFit === "function") {
              graphInstance.zoomToFit(520, 48);
            }
            refreshDisplay();
            // Deactivate all toolbar active states
            var allBtns = element.querySelectorAll(".hexo-knowledge-graph__toolbar-btn");
            for (var ai = 0; ai < allBtns.length; ai++) {
              allBtns[ai].classList.remove("is-active");
            }
          } else if (action === "toggle-labels") {
            // Cycle: important → all → hover → important
            if (labelMode === "important") {
              labelMode = "all";
              this.classList.add("is-active");
            } else if (labelMode === "all") {
              labelMode = "hover";
            } else {
              labelMode = "important";
              this.classList.remove("is-active");
            }
            refreshDisplay();
          } else if (action === "toggle-layout") {
            // Toggle between force and radial-ish layout
            layoutMode = layoutMode === "force" ? "cluster" : "force";
            if (layoutMode === "cluster") {
              this.classList.add("is-active");
              // Apply stronger centering forces per cluster
              try {
                if (typeof graphInstance.d3Force === "function") {
                  var chargeForce = graphInstance.d3Force("charge");
                  if (chargeForce) {
                    chargeForce.strength(function (node) {
                      if (node.type === "topic" && node.layer === "core") return -380;
                      return -120;
                    });
                  }
                  var linkForce = graphInstance.d3Force("link");
                  if (linkForce) {
                    linkForce.distance(function (link) {
                      if (link.type === "topic") return 40;
                      return 60;
                    });
                  }
                }
              } catch (err) {
                // Ignore force errors
              }
            } else {
              this.classList.remove("is-active");
              configureForces(graphInstance);
            }
            if (typeof graphInstance.d3ReheatSimulation === "function") {
              graphInstance.d3ReheatSimulation();
            }
            fitPending = true;
          }
        });
      }

      // Search input
      if (searchInput) {
        searchInput.addEventListener("input", function () {
          var query = this.value.trim();
          var results = searchNodes(query, searchIndex);
          if (searchDropdown) {
            if (results.length > 0 && query.length > 0) {
              searchDropdown.innerHTML = "";
              for (var ri = 0; ri < results.length; ri++) {
                var item = documentRef.createElement("div");
                item.className = "hexo-knowledge-graph__search-item";
                var dot = documentRef.createElement("span");
                dot.className = "dot";
                var nodeColor = resolveNodeColor(results[ri], buildRenderState());
                dot.style.backgroundColor = nodeColor;
                item.appendChild(dot);
                item.appendChild(documentRef.createTextNode(results[ri].name || results[ri].id));
                (function (node) {
                  item.addEventListener("click", function () {
                    // Center on the node
                    if (typeof graphInstance.centerAt === "function") {
                      graphInstance.centerAt(node.x, node.y, 800);
                      graphInstance.zoom(3, 800);
                    }
                    selectedNode = node;
                    updateConnectedNodes(node.id);
                    showDetailPanel(element, node, fullGraphData);
                    refreshDisplay();
                    searchDropdown.classList.remove("is-open");
                    searchInput.value = "";
                  });
                })(results[ri]);
                searchDropdown.appendChild(item);
              }
              searchDropdown.classList.add("is-open");
            } else {
              searchDropdown.classList.remove("is-open");
            }
          }
        });

        searchInput.addEventListener("keydown", function (e) {
          if (e.key === "Escape") {
            searchDropdown.classList.remove("is-open");
            this.value = "";
            this.blur();
          }
        });

        searchInput.addEventListener("blur", function () {
          // Delay to allow click on dropdown items
          setTimeout(function () {
            if (searchDropdown) searchDropdown.classList.remove("is-open");
          }, 200);
        });
      }

      // Detail panel close
      var detailClose = element.querySelector(".hexo-knowledge-graph__detail-close");
      if (detailClose) {
        detailClose.addEventListener("click", function () {
          selectedNode = null;
          updateConnectedNodes(null);
          hideDetailPanel(element);
          refreshDisplay();
        });
      }

      // Expand button
      if (expandBtn) {
        expandBtn.addEventListener("click", function () {
          expanded = !expanded;
          this.textContent = expanded ? "收起知识网络" : "展开知识网络";
          applyGraphData();
        });
      }

      // Reset button (category view reset)
      if (resetBtn) {
        resetBtn.addEventListener("click", function () {
          // Reset to overview
          selectedNode = null;
          hoveredNode = null;
          updateConnectedNodes(null);
          hideDetailPanel(element);
          if (graphInstance && fullGraphData) {
            var overviewData = filterGraphForView(fullGraphData, false);
            graphInstance.graphData(overviewData);
            currentViewNodes = overviewData.nodes || [];
            searchIndex = buildSearchIndex(currentViewNodes);
            if (typeof graphInstance.d3ReheatSimulation === "function") {
              graphInstance.d3ReheatSimulation();
            }
            fitPending = true;
            fitTimer = scheduleZoomToFit(graphInstance, options.schedule || globalThis.setTimeout);
            element.knowledgeGraphFitTimer = fitTimer;
          }
          resetBtn.hidden = true;
        });
      }

      // ── Resize observer ─────────────────────────────────────────
      if (typeof globalThis.ResizeObserver === "function") {
        var observer = new globalThis.ResizeObserver(function () {
          graphInstance
            .width(canvas.clientWidth)
            .height(canvas.clientHeight);
        });
        observer.observe(canvas);
        element.knowledgeGraphResizeObserver = observer;
      }

      // ── Theme observer ─────────────────────────────────────────
      var MutationObserverImpl = options.MutationObserver
        || windowRef.MutationObserver
        || globalThis.MutationObserver;
      if (
        typeof MutationObserverImpl === "function"
        && documentRef.documentElement
      ) {
        var themeObserver = new MutationObserverImpl(function () {
          if (typeof graphInstance.refresh === "function") {
            graphInstance.refresh();
          }
        });
        themeObserver.observe(documentRef.documentElement, {
          attributes: true,
          attributeFilter: ["class", "data-theme", "style"]
        });
        element.knowledgeGraphThemeObserver = themeObserver;
      }

      // ── Load data and start ────────────────────────────────────
      return loadGraphData(dataUrl, fetchImpl).then(function (data) {
        fullGraphData = data;
        expandBtn.hidden = false;
        resetBtn.hidden = true;
        applyGraphData();

        element.knowledgeGraphInstance = graphInstance;
        element.dataset.knowledgeGraphMounted = "true";
        element.classList.add("is-ready");
        mountedElements.add(element);
        if (status) status.textContent = "";

        return {
          start: function () { return fullGraphData; },
          getSelectedCategoryId: function () { return null; },
          handleNodeClick: function () { return null; },
          handleBackgroundClick: function () { return null; },
          reset: function () {
            expanded = false;
            if (expandBtn) expandBtn.textContent = "展开知识网络";
            selectedNode = null;
            hoveredNode = null;
            updateConnectedNodes(null);
            hideDetailPanel(element);
            applyGraphData();
            return fullGraphData;
          }
        };
      });
    } catch (error) {
      element.dataset.knowledgeGraphMounted = "error";
      element.classList.add("is-error");
      if (status) {
        status.textContent = "知识网络加载失败：" + error.message;
      }
      return Promise.resolve(null);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────

  function boot(options) {
    var documentRef = options.document || globalThis.document;
    var locationRef = options.location || globalThis.location;
    if (!documentRef) return Promise.resolve([]);

    for (var i = 0; i < Array.from(mountedElements).length; i++) {
      var el = Array.from(mountedElements)[i];
      if (el.isConnected === false) {
        disposeElement(el, options.clearSchedule || globalThis.clearTimeout);
      }
    }

    var existingAutoMount = documentRef.getElementById("hexo-knowledge-graph-auto");
    if (shouldAutoMount(locationRef, options)) {
      insertAutoMount(documentRef, options);
    } else if (existingAutoMount) {
      disposeElement(existingAutoMount, options.clearSchedule || globalThis.clearTimeout);
      existingAutoMount.remove();
    }

    var mounts = Array.from(
      documentRef.querySelectorAll("[data-knowledge-graph]")
    );
    return Promise.all(mounts.map(function (element) {
      return mountElement(element, { ...options, document: documentRef });
    }));
  }

  // ── API ───────────────────────────────────────────────────────

  return {
    boot: boot,
    colorWithAlpha: colorWithAlpha,
    createGraphController: createGraphController,
    createAutoMountElement: createAutoMountElement,
    disposeElement: disposeElement,
    endpointId: endpointId,
    insertAutoMount: insertAutoMount,
    linkLineDash: linkLineDash,
    loadGraphData: loadGraphData,
    mountElement: mountElement,
    nodeValue: nodeValue,
    normalizePagePath: normalizePagePath,
    resolveGraphColors: resolveGraphColors,
    resolveLabelColors: resolveLabelColors,
    scheduleZoomToFit: scheduleZoomToFit,
    shouldAutoMount: shouldAutoMount,
    selectGraphView: selectGraphView
  };
});
