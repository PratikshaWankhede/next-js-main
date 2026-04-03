import { createServer } from "http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.WS_PORT) || 3001;

// Map<leadId, Set<WebSocket>>
const leadRooms = new Map<string, Set<WebSocket>>();

// Map<userId, Set<WebSocket>>
const userRooms = new Map<string, Set<WebSocket>>();

// Map<WebSocket, { leads: Set<leadId>; users: Set<userId> }> for cleanup on disconnect
const wsToRooms = new Map<
  WebSocket,
  { leads: Set<string>; users: Set<string> }
>();

function leaveAllRooms(ws: WebSocket) {
  const mapping = wsToRooms.get(ws);
  if (!mapping) return;

  for (const leadId of mapping.leads) {
    const room = leadRooms.get(leadId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) leadRooms.delete(leadId);
    }
  }

  for (const userId of mapping.users) {
    const room = userRooms.get(userId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) userRooms.delete(userId);
    }
  }

  wsToRooms.delete(ws);
}

function leaveRoom(ws: WebSocket, leadId: string) {
  const room = leadRooms.get(leadId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) leadRooms.delete(leadId);
  }
  const mapping = wsToRooms.get(ws);
  if (mapping) {
    mapping.leads.delete(leadId);
  }
}

function joinRoom(ws: WebSocket, leadId: string) {
  if (!leadRooms.has(leadId)) {
    leadRooms.set(leadId, new Set());
  }
  leadRooms.get(leadId)!.add(ws);

  if (!wsToRooms.has(ws)) {
    wsToRooms.set(ws, { leads: new Set(), users: new Set() });
  }
  wsToRooms.get(ws)!.leads.add(leadId);
}

function joinUserRoom(ws: WebSocket, userId: string) {
  if (!userRooms.has(userId)) {
    userRooms.set(userId, new Set());
  }
  userRooms.get(userId)!.add(ws);

  if (!wsToRooms.has(ws)) {
    wsToRooms.set(ws, { leads: new Set(), users: new Set() });
  }
  wsToRooms.get(ws)!.users.add(userId);
}

function broadcastToRoom(leadId: string, payload: object) {
  const room = leadRooms.get(leadId);
  if (!room) return;

  const data = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

function broadcastToUser(userId: string, payload: object) {
  const room = userRooms.get(userId);
  if (!room) return;

  const data = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/broadcast") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const { leadId, message, userId, notification } = JSON.parse(body) as {
          leadId?: string;
          message?: object;
          userId?: string;
          notification?: object;
        };
        if (leadId && message) {
          broadcastToRoom(leadId, {
            type: "chat:message:new",
            leadId,
            message,
          });
        }
        if (userId && notification) {
          broadcastToUser(userId, {
            type: "notification:new",
            userId,
            notification,
          });
        }
        if (leadId && notification) {
          broadcastToRoom(leadId, {
            type: "notification:new",
            notification,
          });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as {
        type?: string;
        leadId?: string;
        userId?: string;
      };
      if (data.type === "join" && typeof data.leadId === "string") {
        joinRoom(ws, data.leadId);
      } else if (data.type === "leave" && typeof data.leadId === "string") {
        leaveRoom(ws, data.leadId);
      } else if (data.type === "join-user" && typeof data.userId === "string") {
        joinUserRoom(ws, data.userId);
      }
    } catch {
      // ignore invalid messages
    }
  });

  ws.on("close", () => {
    leaveAllRooms(ws);
  });
});

server.listen(PORT, () => {
  console.log(`[WS] Server listening on port ${PORT}`);
});

function shutdown() {
  wss.close();
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
