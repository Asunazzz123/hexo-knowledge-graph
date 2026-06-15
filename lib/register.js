"use strict";

const { getConfig } = require("./config");
const {
  renderBodyInjection,
  renderHeadInjection,
  renderMount
} = require("./render");
const { createRoutes } = require("./routes");

function register(hexo, overrides = {}) {
  if (!hexo?.extend) {
    throw new TypeError("A Hexo instance is required");
  }

  let mountSequence = 0;
  const nextMountId = () => `hexo-knowledge-graph-${++mountSequence}`;
  const currentConfig = () => getConfig(hexo.config || {});

  hexo.extend.generator.register("knowledge_graph", function generate(locals) {
    const config = currentConfig();
    if (!config.enable) return [];
    return createRoutes({
      locals,
      config,
      resolveForceGraphAsset: overrides.resolveForceGraphAsset
    });
  });

  hexo.extend.helper.register("knowledge_graph", function knowledgeGraph(options = {}) {
    const config = getConfig(this?.config || hexo.config || {});
    return renderMount({
      id: options.id || nextMountId(),
      title: options.title || config.title,
      dataUrl: options.dataUrl || config.dataUrl,
      height: options.height || config.height
    });
  });

  hexo.extend.tag.register("knowledge_graph", function knowledgeGraphTag(args) {
    const config = currentConfig();
    return renderMount({
      id: nextMountId(),
      title: config.title,
      dataUrl: config.dataUrl,
      height: args?.[0] || config.height
    });
  });

  const config = currentConfig();
  if (config.enable && hexo.extend.injector?.register) {
    hexo.extend.injector.register(
      "head_end",
      renderHeadInjection(config),
      "default"
    );
    hexo.extend.injector.register(
      "body_end",
      renderBodyInjection(config),
      "default"
    );
  }

  return {
    config
  };
}

module.exports = {
  register
};
