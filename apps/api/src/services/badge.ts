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

/** A badge with a label (left) and a message (right). */
export function renderBadge(label: string, message: string, muted = false): string {
  const labelWidth = textWidth(label) + PADDING * 2;
  const messageWidth = textWidth(message) + PADDING * 2;
  const width = labelWidth + messageWidth;
  const title = escapeXml(`${label}: ${message}`);
  const text = (value: string, x: number) =>
    `<text x="${x}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(value)}</text><text x="${x}" y="14">${escapeXml(value)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}"><title>${title}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${width}" height="20" rx="4" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${labelWidth}" height="20" fill="${LABEL_COLOR}"/><rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${muted ? MUTED_COLOR : MESSAGE_COLOR}"/><rect width="${width}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">${text(label, labelWidth / 2)}${text(message, labelWidth + messageWidth / 2)}</g></svg>`;
}

/** "94 contributions · 5-week streak" */
export function badgeMessage(total: number, streak: { length: number; period: "week" | "day" }) {
  const contributions = `${new Intl.NumberFormat("en").format(total)} contribution${total === 1 ? "" : "s"}`;
  return streak.length > 0
    ? `${contributions} · ${streak.length}-${streak.period} streak`
    : contributions;
}
