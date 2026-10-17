// README badge: a two-part SVG in the style of shields.io, in brand colors.

const LABEL_COLOR = "#1F024C"; // Midnight Plum
const MESSAGE_COLOR = "#8F1383"; // Orchid
const MUTED_COLOR = "#6B5683"; // Dusk, for "not available"

/** Approximate advance widths of Verdana at 11px, the badge font (like shields.io). */
function textWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (" .,:;·|!'".includes(char)) width += 3.9;
    else if ("ijlft-()[]".includes(char)) width += 4.4;
    else if ("mwMW@".includes(char)) width += 10.6;
    else if (/[A-Z0-9#%&]/.test(char)) width += 7.6;
    else width += 6.8;
  }
  return Math.ceil(width);
}

const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const PADDING = 8;

export interface BadgeOptions {
  /** Right-hand side background color (hex, e.g. "45056E" or "#45056E", or CSS name e.g. "blue"). */
  color?: string;
  /** Badge size preset ("small", "medium", "large") or numeric height in pixels (15-100). */
  size?: "small" | "medium" | "large" | "sm" | "md" | "lg" | string;
}

const HEX_COLOR_RE = /^#?([0-9a-fA-F]{3,8})$/;
const CSS_COLOR_NAME_RE = /^[a-zA-Z]{3,20}$/;

function resolveColor(color?: string): string | null {
  if (!color) return null;
  const hexMatch = HEX_COLOR_RE.exec(color);
  if (hexMatch) return `#${hexMatch[1]}`;
  if (CSS_COLOR_NAME_RE.test(color)) return color;
  return null;
}

function resolveHeight(size?: string): number {
  if (!size) return 20;
  const normalized = size.trim().toLowerCase();
  if (normalized === "sm" || normalized === "small") return 20;
  if (normalized === "md" || normalized === "medium") return 28;
  if (normalized === "lg" || normalized === "large") return 36;
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric >= 15 && numeric <= 100) {
    return Math.round(numeric);
  }
  return 20;
}

/** A badge with a label (left) and a message (right). */
export function renderBadge(
  label: string,
  message: string,
  muted = false,
  options?: BadgeOptions,
): string {
  const labelWidth = textWidth(label) + PADDING * 2;
  const messageWidth = textWidth(message) + PADDING * 2;
  const baseWidth = labelWidth + messageWidth;
  const height = resolveHeight(options?.size);
  const scale = height / 20;
  const width = Math.round(baseWidth * scale);
  const title = escapeXml(`${label}: ${message}`);
  const customColor = resolveColor(options?.color);
  const rightBg = muted ? MUTED_COLOR : (customColor ?? MESSAGE_COLOR);

  const text = (value: string, x: number) =>
    `<text x="${x}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(value)}</text><text x="${x}" y="14">${escapeXml(value)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${baseWidth} 20" width="${width}" height="${height}" role="img" aria-label="${title}"><title>${title}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${baseWidth}" height="20" rx="4" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${labelWidth}" height="20" fill="${LABEL_COLOR}"/><rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${rightBg}"/><rect width="${baseWidth}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">${text(label, labelWidth / 2)}${text(message, labelWidth + messageWidth / 2)}</g></svg>`;
}

/** "94 contributions · 5-week streak" */
export function badgeMessage(total: number, streak: { length: number; period: "week" | "day" }) {
  const contributions = `${new Intl.NumberFormat("en").format(total)} contribution${total === 1 ? "" : "s"}`;
  return streak.length > 0
    ? `${contributions} · ${streak.length}-${streak.period} streak`
    : contributions;
}
