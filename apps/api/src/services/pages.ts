// Minimal HTML pages for the links in emails (confirm an address, unsubscribe, stop emails).
// They work without the web app, in the Sunset Violet colors.

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export function htmlPage(title: string, body: string, logoUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} | Open Source Guru</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 34rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.55; color: #1f024c; background: #fbf7fd; }
  header { display: flex; align-items: center; gap: .6rem; font-weight: 800; font-size: 1.1rem; margin-bottom: 1.5rem; }
  header span { color: #8f1383; }
  main { background: #fff; border: 1px solid #e3d5ee; border-radius: 16px; padding: 1.75rem 2rem; }
  h1 { margin: 0 0 .75rem; font-size: 1.5rem; letter-spacing: -.01em; }
  button { font: inherit; font-weight: 600; padding: .65rem 1.3rem; border-radius: 999px; border: 0; background: #45056e; color: #fff; cursor: pointer; }
  button:hover { background: #8f1383; }
  a { color: #8f1383; font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    body { background: #12012e; color: #f6eefb; }
    main { background: #1f024c; border-color: #3a1468; }
    header span, a { color: #d04fb8; }
    button { background: #b57be0; color: #12012e; }
  }
</style>
</head>
<body>
<header><img src="${escapeHtml(logoUrl)}" alt="" width="32" height="32"><div>Open Source <span>Guru</span></div></header>
<main>
<h1>${escapeHtml(title)}</h1>
${body}
</main>
</body>
</html>`;
}
