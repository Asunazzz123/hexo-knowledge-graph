"use strict";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function renderMount(options) {
  const id = escapeHtml(options.id);
  const title = escapeHtml(options.title);
  const dataUrl = escapeHtml(options.dataUrl);
  const height = escapeHtml(options.height);

  return [
    `<section id="${id}" class="hexo-knowledge-graph"`,
    ` data-knowledge-graph data-data-url="${dataUrl}"`,
    ` data-title="${title}" style="--hexo-knowledge-graph-height:${height}">`,
    `<div class="hexo-knowledge-graph__header">`,
    `<h2 class="hexo-knowledge-graph__title">${title}</h2>`,
    `<div class="hexo-knowledge-graph__header-actions">`,
    `<button class="hexo-knowledge-graph__expand-btn" type="button" hidden>展开知识网络</button>`,
    `<button class="hexo-knowledge-graph__reset" type="button" hidden>返回总览</button>`,
    `</div>`,
    `</div>`,
    `<div class="hexo-knowledge-graph__canvas-wrap">`,
    `<div class="hexo-knowledge-graph__search">`,
    `<input class="hexo-knowledge-graph__search-input" type="text" placeholder="搜索节点..." autocomplete="off">`,
    `<div class="hexo-knowledge-graph__search-dropdown"></div>`,
    `</div>`,
    `<div class="hexo-knowledge-graph__toolbar">`,
    `<button class="hexo-knowledge-graph__toolbar-btn" data-action="search" title="搜索" aria-label="搜索节点">`,
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>`,
    `</button>`,
    `<button class="hexo-knowledge-graph__toolbar-btn" data-action="reset" title="重置视图" aria-label="重置视图">`,
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    `</button>`,
    `<div class="hexo-knowledge-graph__toolbar-divider"></div>`,
    `<button class="hexo-knowledge-graph__toolbar-btn" data-action="toggle-labels" title="切换标签显示" aria-label="切换标签显示">`,
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h4M7 12h6M7 16h3"/></svg>`,
    `</button>`,
    `<button class="hexo-knowledge-graph__toolbar-btn" data-action="toggle-layout" title="切换布局" aria-label="切换布局">`,
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/></svg>`,
    `</button>`,
    `</div>`,
    `<div class="hexo-knowledge-graph__detail">`,
    `<button class="hexo-knowledge-graph__detail-close" type="button" aria-label="关闭详情">&times;</button>`,
    `<div class="hexo-knowledge-graph__detail-title"></div>`,
    `<div class="hexo-knowledge-graph__detail-stats"></div>`,
    `</div>`,
    `<div class="hexo-knowledge-graph__legend"></div>`,
    `<div class="hexo-knowledge-graph__canvas" role="img" aria-label="${title}"></div>`,
    `</div>`,
    `<p class="hexo-knowledge-graph__status" aria-live="polite">正在加载知识网络...</p>`,
    `</section>`
  ].join("");
}

function renderHeadInjection(config) {
  return `<link rel="stylesheet" href="${escapeHtml(config.assetBaseUrl)}knowledge-graph.css">`;
}

function renderBodyInjection(config) {
  const bootstrap = {
    autoMount: config.autoMount,
    categoriesPath: config.categoriesPath,
    targetSelector: config.targetSelector,
    insertPosition: config.insertPosition,
    title: config.title,
    height: config.height,
    dataUrl: config.dataUrl,
    colors: config.colors
  };
  const assetBaseUrl = escapeHtml(config.assetBaseUrl);

  return [
    `<script src="${assetBaseUrl}force-graph.min.js"></script>`,
    `<script src="${assetBaseUrl}knowledge-graph.js"></script>`,
    `<script>(function(){`,
    `var options=${safeJson(bootstrap)};`,
    `var run=function(){if(window.HexoKnowledgeGraph){window.HexoKnowledgeGraph.boot(options);}};`,
    `if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",run,{once:true});}else{run();}`,
    `document.addEventListener("pjax:complete",run);`,
    `document.addEventListener("pjax:success",run);`,
    `})();</script>`
  ].join("");
}

module.exports = {
  escapeHtml,
  renderBodyInjection,
  renderHeadInjection,
  renderMount,
  safeJson
};
