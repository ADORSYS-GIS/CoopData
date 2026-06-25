import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import server from "./dist/server/server.js";

const port = parseInt(process.env.PORT || "3001", 10);
const host = process.env.HOST || "0.0.0.0";
const clientDir = new URL("./dist/client/", import.meta.url).pathname;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webp": "image/webp",
  ".map": "application/json",
};

const IMMUTABLE_EXTENSIONS = new Set([".css", ".js", ".mjs", ".woff", ".woff2", ".ttf", ".svg", ".png", ".jpg", ".webp"]);

async function serveStatic(pathname) {
  const filePath = join(clientDir, pathname);
  if (!filePath.startsWith(clientDir)) return null;
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const headers = { "content-type": contentType };
    if (IMMUTABLE_EXTENSIONS.has(ext)) {
      headers["cache-control"] = "public, max-age=31536000, immutable";
    } else {
      headers["cache-control"] = "public, max-age=3600";
    }
    return new Response(data, { status: 200, headers });
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

    if (url.pathname.startsWith("/assets/") || url.pathname === "/robots.txt" || url.pathname === "/favicon.ico") {
      const staticResponse = await serveStatic(url.pathname);
      if (staticResponse) {
        res.statusCode = staticResponse.status;
        for (const [key, value] of staticResponse.headers.entries()) {
          res.setHeader(key, value);
        }
        const body = await staticResponse.arrayBuffer();
        res.end(Buffer.from(body));
        return;
      }
    }

    const init = {
      method: req.method,
      headers: Object.entries(req.headers).reduce((h, [k, v]) => {
        if (v != null) h[k] = Array.isArray(v) ? v.join(", ") : v;
        return h;
      }, {}),
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half",
    };
    const response = await server.fetch(new Request(url, init));
    if (response.status === 404) {
      const staticResponse = await serveStatic(url.pathname);
      if (staticResponse) {
        res.statusCode = staticResponse.status;
        for (const [key, value] of staticResponse.headers.entries()) {
          res.setHeader(key, value);
        }
        const body = await staticResponse.arrayBuffer();
        res.end(Buffer.from(body));
        return;
      }
    }
    res.statusCode = response.status;
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
      res.end("Internal Server Error");
    }
  }
}).listen(port, host, () => {
  console.log(`Frontend server listening on http://${host}:${port}`);
});