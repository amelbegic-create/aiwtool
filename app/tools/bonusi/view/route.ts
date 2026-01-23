import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

function injectCss(html: string) {
  const css = `
    <style id="bonusi-fullscreen-override">
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: #ffffff !important;
        overflow: hidden !important;
      }

      /* Najčešći “AI portable app” wrapperi */
      #app, #root, .app, .App, .container, .wrapper, .page, .main, .content {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      /* Ako je prvi element na body-u taj centralni panel */
      body > * {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      /* Često imaju overlay background “dark” */
      .overlay, .backdrop, .modal-backdrop, .bg, .background {
        background: #ffffff !important;
      }
    </style>
  `;

  if (html.includes("</head>")) return html.replace("</head>", `${css}</head>`);
  if (html.includes("<body")) return html.replace(/<body([^>]*)>/i, `<body$1>${css}`);
  return css + html;
}

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "tools", "bonusi", "bonusi.html");
  const raw = await readFile(filePath, "utf8");
  const patched = injectCss(raw);

  return new Response(patched, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
