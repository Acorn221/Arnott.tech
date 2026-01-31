import type {
  SpinnerState,
  SpinnerMessage,
  SpinnerRoomInfo,
} from "@arnott/shared";

interface WebSocketSession {
  webSocket: WebSocket;
  userId: string;
}

/**
 * Durable Object for managing a spinner room
 * Handles WebSocket connections for real-time spinner state sync
 */
export class SpinnerRoom implements DurableObject {
  private sessions: Map<WebSocket, WebSocketSession> = new Map();
  private state: DurableObjectState;

  private currentSpinnerState: SpinnerState = {
    rotation: 0,
    angularVelocity: 0,
    isDragging: false,
    draggingUserId: null,
    timestamp: Date.now(),
    spinCount: 0,
  };

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<SpinnerState>("spinnerState");
      if (stored) {
        this.currentSpinnerState = stored;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    if (url.pathname === "/info") {
      return this.handleInfoRequest();
    }

    return new Response("Not Found", { status: 404 });
  }

  private handleWebSocketUpgrade(request: Request): Response {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const userId = crypto.randomUUID();

    this.state.acceptWebSocket(server);

    const session: WebSocketSession = {
      webSocket: server,
      userId,
    };
    this.sessions.set(server, session);

    // Send current state to newly connected client
    server.send(
      JSON.stringify({
        type: "state",
        payload: this.currentSpinnerState,
      } satisfies SpinnerMessage),
    );

    // Notify others about the new user
    this.broadcast(
      {
        type: "join",
        payload: { userId },
      },
      server,
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleInfoRequest(): Response {
    const info: SpinnerRoomInfo = {
      connectedUsers: this.sessions.size,
      totalSpins: this.currentSpinnerState.spinCount,
    };
    return Response.json(info);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;

    try {
      const parsed = JSON.parse(message) as SpinnerMessage;
      const session = this.sessions.get(ws);

      if (!session) return;

      switch (parsed.type) {
        case "state":
        case "sync":
          // Update state and broadcast to all other clients
          this.currentSpinnerState = {
            ...parsed.payload,
            timestamp: Date.now(),
          };
          // Persist state periodically (on drag end or significant changes)
          if (
            !parsed.payload.isDragging &&
            this.currentSpinnerState.spinCount > 0
          ) {
            await this.state.storage.put(
              "spinnerState",
              this.currentSpinnerState,
            );
          }
          this.broadcast(
            {
              type: "sync",
              payload: this.currentSpinnerState,
            },
            ws,
          );
          break;

        case "request-state":
          ws.send(
            JSON.stringify({
              type: "state",
              payload: this.currentSpinnerState,
            } satisfies SpinnerMessage),
          );
          break;
      }
    } catch (e) {
      console.error("Failed to parse WebSocket message:", e);
    }
  }

  async webSocketClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (session) {
      this.broadcast(
        {
          type: "leave",
          payload: { userId: session.userId },
        },
        ws,
      );
      this.sessions.delete(ws);

      // If the dragging user disconnected, release the drag lock
      if (this.currentSpinnerState.draggingUserId === session.userId) {
        this.currentSpinnerState.isDragging = false;
        this.currentSpinnerState.draggingUserId = null;
        this.broadcast({
          type: "sync",
          payload: this.currentSpinnerState,
        });
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error("WebSocket error:", error);
    await this.webSocketClose(ws);
  }

  private broadcast(message: SpinnerMessage, exclude?: WebSocket) {
    const messageStr = JSON.stringify(message);
    for (const [ws] of this.sessions) {
      if (ws !== exclude && ws.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          ws.send(messageStr);
        } catch (e) {
          console.error("Failed to send message:", e);
        }
      }
    }
  }
}
