/* Tiny static server for the production build in dist/ (run after `bun run build`).
   Uses Bun's native HTTP server — no Python, no extra dependencies.
   Localhost is a secure context, so the Web Crypto demos work. */

const DIST = new URL("./dist/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 8000);

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    const file = Bun.file(DIST + pathname.replace(/^\/+/, ""));
    if (await file.exists()) return new Response(file);

    return new Response("404 — run `bun run build` first?", { status: 404 });
  },
});

console.log(`▶ ChainLab (built) running at ${server.url}`);
