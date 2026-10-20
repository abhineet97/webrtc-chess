import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { WebSocketServer } from "ws";

const distDir = join(new URL(".", import.meta.url).pathname.replace(/\/$/, ""), "dist");

const MIME = {
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
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function serveFile(req, res) {
  const { pathname } = new URL(req.url, "http://localhost");
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
const rooms = new Map();

wss.on("connection", (socket, req) => {
  const { searchParams } = new URL(req.url, "http://localhost");
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
    for (const client of room) {
      if (client.readyState === client.OPEN) {
        client.send(data.toString());
      }
    }
  });

  socket.on("close", () => {
    room.delete(socket);
    if (room.size === 0) rooms.delete(roomId);
  });

  socket.on("error", (err) => {
    console.error(err);
    socket.terminate();
  });
});

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, "http://localhost");
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
