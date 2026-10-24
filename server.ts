import http from "node:http";
import type { Duplex } from "node:stream";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";

// Compiled to build/server.mjs, so dist/ is one level up.
const distDir = fileURLToPath(new URL("../dist", import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/**
 * Serves static files from dist/. Falls back to index.html for the root path.
 */
async function serveFile(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const filePath = normalize(
    join(distDir, pathname === "/" ? "index.html" : decodeURIComponent(pathname)),
  );

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

const server = http.createServer(serveFile);
const wss = new WebSocketServer({ noServer: true });

/**
 * Room id -> set of connected sockets. Messages are relayed to everyone in
 * the room, including the sender. Rooms are removed once their last client
 * leaves.
 */
const rooms = new Map<string, Set<WebSocket>>();

wss.on("connection", (socket: WebSocket, req: http.IncomingMessage) => {
  const { searchParams } = new URL(req.url ?? "/", "http://localhost");
  const roomId = searchParams.get("id");
  if (!roomId) {
    socket.close();
    return;
  }

  let room = rooms.get(roomId);
  if (!room) {
    room = new Set();
    rooms.set(roomId, room);
  }
  room.add(socket);

  socket.on("message", (data) => {
    const raw = Array.isArray(data) ? Buffer.concat(data) : data;
    const message = raw instanceof ArrayBuffer ? Buffer.from(raw).toString() : raw.toString();

    for (const client of room) {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    }
  });

  socket.on("close", () => {
    room.delete(socket);
    if (room.size === 0) rooms.delete(roomId);
  });

  socket.on("error", (err: Error) => {
    console.error(err);
    socket.terminate();
  });
});

server.on("upgrade", (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (client, clientRequest) => {
      wss.emit("connection", client, clientRequest);
    });
  } else {
    socket.destroy();
  }
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`webrtc-chess running on http://localhost:${port}`);
});
