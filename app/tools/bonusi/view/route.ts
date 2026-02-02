import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function injectCss(html: string): string {
  const css = `
<style id="bonusi-fullscreen-override">
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    min-height: 100% !important;
    background: #ffffff !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }
  #app, #root, .app, .App, .container, .wrapper, .page, .main, .content {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  body > * {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  .overlay, .backdrop, .modal-backdrop, .bg, .background {
    background: #ffffff !important;
  }
</style>
  `.trim();

  if (html.includes("</head>")) return html.replace("</head>", `${css}\n</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, `<body$1>\n${css}\n`);
  return `${css}\n${html}`;
}

async function loadHtml(req: Request): Promise<string> {
  // primary: FS
  try {
    const filePath = path.join(process.cwd(), "public", "tools", "bonusi", "bonusi.html");
    return await readFile(filePath, "utf8");
  } catch {
    // fallback: HTTP fetch from same deployment
    const url = new URL("/tools/bonusi/bonusi.html", req.url);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Missing bonusi.html (status ${res.status})`);
    return await res.text();
  }
}

export async function GET(req: Request): Promise<Response> {
  try {
    const raw = await loadHtml(req);
    const patched = injectCss(raw);

    return new Response(patched, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(`Bonusi view error: ${msg}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
