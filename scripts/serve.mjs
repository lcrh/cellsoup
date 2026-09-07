import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.argv.includes("--dist") ? "dist" : ".");
const port = Number(process.env.PORT || 8000);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/plain",
};
http
  .createServer(async (req, res) => {
    try {
      let name = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (name === "/") name = "/index.html";
      if (root.endsWith("/dist") === false && name != "/index.html")
        name = "/web" + name;
      const file = path.resolve(root, "." + name);
      if (!file.startsWith(root + path.sep)) throw Error();
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Cell Soup: http://localhost:${port}`),
  );
