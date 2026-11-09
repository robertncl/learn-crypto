/* Tiny static server for the production build in dist/ (run after `bun run build`).
   Uses Bun's native HTTP server — no Python, no extra dependencies.
   Localhost is a secure context, so the Web Crypto demos work.

   Listens on localhost only; set HOST=0.0.0.0 to expose it on your network. */

import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";

const DIST = resolve(new URL("./dist/", import.meta.url).pathname);
const port = Number(process.env.PORT ?? 8000);
const hostname = process.env.HOST ?? "localhost";

/* The page has one inline script (it applies a saved theme before first paint).
   Allow exactly that script by hash instead of permitting inline scripts in general. */
async function contentSecurityPolicy() {
  const html = await Bun.file(`${DIST}${sep}index.html`).text().catch(() => "");
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => `'sha256-${createHash("sha256").update(body).digest("base64")}'`);
  return [
    "default-src 'none'",
    `script-src 'self' ${hashes.join(" ")}`.trim(),
    "style-src 'self'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
const csp = await contentSecurityPolicy();

const headers = {
  "Content-Security-Policy": csp,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const server = Bun.serve({
  port,
  hostname,
  async fetch(req) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("405", { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url).pathname);
    } catch {
      return new Response("400", { status: 400, headers });
    }
    if (pathname.endsWith("/")) pathname += "index.html";

    /* Resolve first, then require the result to stay inside dist/. Checking the raw
       string is not enough: "..%2f" decodes to "../" only after URL normalisation. */
    const target = resolve(DIST, `.${pathname}`);
    if (pathname.includes("\0") || !target.startsWith(DIST + sep)) {
      return new Response("404", { status: 404, headers });
    }

    const file = Bun.file(target);
    if (await file.exists()) return new Response(file, { headers });

    return new Response("404 — run `bun run build` first?", { status: 404, headers });
  },
});

console.log(`▶ ChainLab (built) running at ${server.url}`);
