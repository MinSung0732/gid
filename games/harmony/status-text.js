function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detailStatusMarkup(definition) {
  return `<span class="detail-status" style="--detail-status-color:${definition.color}">${definition.name}</span>`;
}

/**
 * Apply the existing Harmony status colors to status-name keywords in trusted
 * presentation copy. Existing detail-status markup is protected so callers can
 * safely format mixed legacy/new detail HTML without nesting status spans.
 */
export function formatStatusKeywords(value, statusDefinitions = {}) {
  if (typeof value !== "string" || !value) return value;

  const definitions = Object.values(statusDefinitions)
    .filter((definition) => definition?.name && definition?.color)
    .sort((a, b) => b.name.length - a.name.length);
  if (!definitions.length) return value;

  const protectedMarkup = [];
  let formatted = value.replace(
    /<span\b([^>]*)>[\s\S]*?<\/span>/gi,
    (match, attributes) => {
      const className = attributes.match(/\bclass=(['"])(.*?)\1/)?.[2] || "";
      if (!className.split(/\s+/).includes("detail-status")) return match;
      const token = `__HARMONY_DETAIL_STATUS_${protectedMarkup.length}__`;
      protectedMarkup.push(match);
      return token;
    },
  );

  const byName = new Map(definitions.map((definition) => [definition.name, definition]));
  const keywordPattern = new RegExp(
    definitions.map((definition) => escapeRegExp(definition.name)).join("|"),
    "g",
  );

  // Split tags from text so status names in class/style/attribute values are never touched.
  formatted = formatted
    .split(/(<[^>]+>)/g)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part.replace(keywordPattern, (name) => detailStatusMarkup(byName.get(name))),
    )
    .join("");

  protectedMarkup.forEach((markup, index) => {
    formatted = formatted.replace(`__HARMONY_DETAIL_STATUS_${index}__`, markup);
  });
  return formatted;
}
