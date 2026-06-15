"use strict";

const POST_LINK_RE = /{%\s*post_link(?:\s+([\s\S]*?))?\s*%}/g;

function maskIgnoredMarkdown(source) {
  return String(source || "")
    .replace(/<!--[\s\S]*?-->/g, (match) => " ".repeat(match.length))
    .replace(
      /(^|\n)([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2\3(?=\n|$)/g,
      (match) => " ".repeat(match.length)
    )
    .replace(/`[^`\n]*`/g, (match) => " ".repeat(match.length));
}

function tokenizeTagArguments(input) {
  const tokens = [];
  let token = "";
  let quote = "";
  let escaping = false;

  const pushToken = () => {
    if (token) {
      tokens.push(token);
      token = "";
    }
  };

  for (const char of String(input || "")) {
    if (escaping) {
      token += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = "";
      } else {
        token += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      pushToken();
      continue;
    }

    if (char === "|") {
      pushToken();
      tokens.push("|");
      continue;
    }

    token += char;
  }

  if (quote || escaping) {
    return [];
  }

  pushToken();
  return tokens;
}

function parsePostLinks(source) {
  const masked = maskIgnoredMarkdown(source);
  const links = [];

  for (const match of masked.matchAll(POST_LINK_RE)) {
    const body = match[1]?.trim() || "";
    const tokens = tokenizeTagArguments(body);

    if (!tokens.length || !tokens[0]) {
      continue;
    }

    const targetWithAnchor = tokens[0];
    const hashIndex = targetWithAnchor.indexOf("#");
    const target = hashIndex >= 0
      ? targetWithAnchor.slice(0, hashIndex)
      : targetWithAnchor;
    const anchor = hashIndex >= 0
      ? targetWithAnchor.slice(hashIndex + 1)
      : "";
    const labelTokens = tokens[1] === "|" ? tokens.slice(2) : tokens.slice(1);

    if (!target) {
      continue;
    }

    links.push({
      target,
      anchor,
      label: labelTokens.join(" "),
      raw: body
    });
  }

  POST_LINK_RE.lastIndex = 0;
  return links;
}

module.exports = {
  maskIgnoredMarkdown,
  parsePostLinks,
  tokenizeTagArguments
};
