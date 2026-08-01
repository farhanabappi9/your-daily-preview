/**
 * Product description parser.
 *
 * Product descriptions are written as rich plain text (a headline, body
 * paragraphs, emoji-marked spec lines and offer lines). Rendering them inside
 * a single <p> collapses every newline, which makes the text look jumbled.
 * These helpers turn the raw text into structured, renderable blocks.
 */

export type DescBlock =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "bullets"; items: { marker: string; label?: string; text: string }[] }
  | { kind: "highlights"; items: { marker: string; text: string }[] };

/** Emoji / dash markers that start a line. */
const MARKER_RE = /^((?:\p{Extended_Pictographic}\uFE0F?)|[•*]|-\s)\s*/u;
/** Markers that mean "offer / delivery callout" rather than a spec. */
const HIGHLIGHT_MARKERS = new Set(["💰", "📦", "🎁", "🚚", "🔥", "💥", "🕒", "📞", "⏰", "⚡"]);

function splitLabel(text: string) {
  const m = text.match(/^([^:：ঃ]{2,28})[:：ঃ]\s*(.+)$/u);
  if (m) return { label: m[1].trim(), text: m[2].trim() };
  return { text };
}

/** Parse a raw description string into renderable blocks. */
export function parseDescription(raw: string): DescBlock[] {
  const lines = (raw ?? "").split(/\r?\n/).map((l) => l.trim());
  const blocks: DescBlock[] = [];
  let bullets: { marker: string; label?: string; text: string }[] = [];
  let highlights: { marker: string; text: string }[] = [];
  let paraBuf: string[] = [];
  let headingDone = false;

  const flushPara = () => {
    const text = paraBuf.join(" ").trim();
    paraBuf = [];
    if (text) blocks.push({ kind: "para", text });
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ kind: "bullets", items: bullets });
    bullets = [];
  };
  const flushHighlights = () => {
    if (highlights.length) blocks.push({ kind: "highlights", items: highlights });
    highlights = [];
  };

  for (const line of lines) {
    if (!line) {
      flushPara();
      flushBullets();
      flushHighlights();
      continue;
    }

    // The very first line is the headline of the description.
    if (!headingDone) {
      headingDone = true;
      blocks.push({
        kind: "heading",
        text: line
          .replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "")
          .replace(/[\p{Extended_Pictographic}\uFE0F\s]+(?=—|$)/u, " ")
          .trim(),
      });
      continue;
    }

    const m = line.match(MARKER_RE);
    if (m) {
      const marker = m[1].trim();
      const rest = line.slice(m[0].length).trim();
      if (HIGHLIGHT_MARKERS.has(marker)) {
        flushPara();
        flushBullets();
        highlights.push({ marker, text: rest });
      } else {
        flushPara();
        flushHighlights();
        bullets.push({ marker: marker || "•", ...splitLabel(rest) });
      }
      continue;
    }

    flushBullets();
    flushHighlights();
    paraBuf.push(line);
  }
  flushPara();
  flushBullets();
  flushHighlights();
  return blocks;
}

/** Single-line, emoji-free version — for meta tags, cards and listings. */
export function toPlainDescription(raw: string, maxLength = 160) {
  const text = (raw ?? "")
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.।])/g, "$1")
    .replace(/^[\s—–-]+/, "")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/[\s—–-]+$/, "")}…`;
}
