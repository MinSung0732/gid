function freezeTerm(color, terms) {
  return Object.freeze({ color, terms: Object.freeze([...terms]) });
}

export const DETAIL_TERM_REGISTRY = Object.freeze({
  ap: freezeTerm("#f8e29a", ["AP 환급", "AP"]),
  health: freezeTerm("#ff7184", ["최대 체력", "체력"]),
  shieldPierce: freezeTerm("#78c8e8", [
    "방어막 무시 피해",
    "방어막 관통",
    "관통 피해",
    "완전 관통",
  ]),
  shield: freezeTerm("#8fcbd4", [
    "방어막 비례 피해",
    "방어막 파괴",
    "방어막 보존",
    "방어막 유지",
    "방어막",
  ]),
  absorb: freezeTerm("#cba3e8", ["흡수 감쇄", "흡수"]),
  contact: freezeTerm("#f2a18b", ["접촉 피해", "접촉 공격", "접촉"]),
  nonContact: freezeTerm("#76b8d0", ["비접촉 피해", "비접촉 공격", "비접촉"]),
  oil: freezeTerm("#d9ad69", ["오일"]),
  impurity: freezeTerm("#dac2f3", ["불순물 고정", "불순물"]),
  heal: freezeTerm("#82d49a", ["회복"]),
  cleanse: freezeTerm("#74c9bd", ["정화"]),
  draw: freezeTerm("#78b7e8", ["카드 서치", "드로우", "서치"]),
  discard: freezeTerm("#d78972", ["카드 버리기", "버리기"]),
  fixedDamage: freezeTerm("#e59a7f", ["고정 피해"]),
  damage: freezeTerm("#e59a7f", ["피해"]),
  multiHit: freezeTerm("#e59a7f", ["연타"]),
  ricochet: freezeTerm("#e18bd1", ["도탄"]),
  area: freezeTerm("#e7b65f", ["광역"]),
  execute: freezeTerm("#ef726c", ["처형"]),
  harmony: freezeTerm("#f8e29a", [
    "무료 재발동",
    "HARMONY",
    "하모니",
    "TOP",
    "MIDDLE",
    "BASE",
    "탑",
    "미들",
    "베이스",
  ]),
});

const PROTECTED_CLASS =
  /(?:^|\s)(?:detail-[\w-]+|semantic-term|card-summary-[\w-]+|card-value-modifier)(?:\s|$)/;

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^\$\{\}()|[\]\\]/g, "\\$&");
}

function semanticSpan(text, color, extraClass = "") {
  return `<span class="semantic-term${extraClass ? ` ${extraClass}` : ""}" style="--semantic-term-color:${color}">${text}</span>`;
}

function registryMatchers(registry = DETAIL_TERM_REGISTRY) {
  const matchers = [];
  for (const [key, definition] of Object.entries(registry)) {
    for (const term of definition.terms || [])
      matchers.push({ key, term, color: definition.color, kind: "term" });
  }
  return matchers;
}

function statusMatchers(statusDefinitions = {}) {
  return Object.entries(statusDefinitions)
    .filter(
      ([id, definition]) =>
        id !== "strength" &&
        definition?.name &&
        definition?.color,
    )
    .map(([id, definition]) => ({
      key: `status:${id}`,
      term: definition.name,
      color: definition.color,
      kind: "status",
    }));
}

function sortedMatchers(statusDefinitions, registry) {
  const seen = new Set();
  return [...statusMatchers(statusDefinitions), ...registryMatchers(registry)]
    .filter(({ term }) => {
      if (!term || seen.has(term)) return false;
      seen.add(term);
      return true;
    })
    .sort((a, b) => b.term.length - a.term.length);
}

function transformVisibleText(value, transform) {
  const parts = String(value).split(/(<[^>]+>)/g),
    spanStack = [];
  let protectedDepth = 0;

  return parts
    .map((part) => {
      if (!part.startsWith("<")) return protectedDepth ? part : transform(part);

      const open = part.match(/^<span\b([^>]*)>/i);
      if (open) {
        const className =
            open[1].match(/\bclass=(['"])(.*?)\1/i)?.[2] || "",
          protectedHere = protectedDepth > 0 || PROTECTED_CLASS.test(className);
        spanStack.push(protectedHere);
        if (protectedHere) protectedDepth += 1;
        return part;
      }

      if (/^<\/span\s*>/i.test(part)) {
        const protectedHere = spanStack.pop();
        if (protectedHere) protectedDepth = Math.max(0, protectedDepth - 1);
      }
      return part;
    })
    .join("");
}

export function semanticTermColor(key) {
  return DETAIL_TERM_REGISTRY[key]?.color || null;
}

export function formatSemanticText(
  value,
  {
    context = "detail",
    statusDefinitions = {},
    registry = DETAIL_TERM_REGISTRY,
    neutralKeys = [],
  } = {},
) {
  if (typeof value !== "string" || !value) return value;

  const neutral = new Set(neutralKeys),
    matchers = sortedMatchers(statusDefinitions, registry).filter(
      ({ key }) => !neutral.has(key),
    );
  if (!matchers.length) return value;

  const byTerm = new Map(matchers.map((entry) => [entry.term, entry])),
    pattern = new RegExp(
      matchers.map(({ term }) => escapeRegExp(term)).join("|"),
      "g",
    ),
    summaryClass = context === "handSummary" ? "card-summary-semantic-term" : "";

  return transformVisibleText(value, (text) =>
    text.replace(pattern, (term) => {
      const entry = byTerm.get(term);
      if (!entry) return term;
      if (entry.kind === "status") {
        if (context === "handSummary")
          return `<span class="semantic-term card-summary-semantic-term detail-status" style="--semantic-term-color:${entry.color};--detail-status-color:${entry.color}">${term}</span>`;
        return `<span class="detail-status" style="--detail-status-color:${entry.color}">${term}</span>`;
      }
      return semanticSpan(term, entry.color, summaryClass);
    }),
  );
}
