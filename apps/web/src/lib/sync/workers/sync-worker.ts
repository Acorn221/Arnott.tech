/**
 * SyncWorker - SharedWorker that owns the WebSocket/WebRTC connection.
 *
 * All tabs communicate through this worker. The worker:
 * 1. Maintains a single SignalingTransport connection
 * 2. Broadcasts remote messages to all connected tabs
 * 3. Relays local broadcasts to remote peers and other tabs
 */

import { SignalingTransport } from "../transport/signaling-transport";
import { createLogger } from "@arnott/logger";
import type { SyncMessage, TransportState } from "../transport/types";
import type { TabToWorkerMessage, WorkerToTabMessage, WorkerState } from "../transport/worker-types";

const log = createLogger("sync:worker");

// Connected tab ports
const ports = new Set<MessagePort>();

// Single signaling transport instance
let signaling: SignalingTransport | null = null;
let currentRoomId: string | null = null;
let transportState: TransportState = "disconnected";

/**
 * Handle new tab connection
 */
// @ts-expect-error SharedWorkerGlobalScope
self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  ports.add(port);

  log.info("Tab connected", { tabCount: ports.size });

  port.onmessage = (e: MessageEvent<TabToWorkerMessage>) => {
    handleTabMessage(port, e.data);
  };

  // Clean up when port closes
  port.onmessageerror = () => {
    ports.delete(port);
    log.info("Tab disconnected (error)", { tabCount: ports.size });
  };

  port.start();

  // Send ready signal and current state to new tab
  sendToPort(port, { type: "ready" });
  sendToPort(port, {
    type: "state",
    state: getWorkerState(),
  });
};

/**
 * Handle message from a tab
 */
function handleTabMessage(port: MessagePort, msg: TabToWorkerMessage): void {
  log.debug("Tab message received", { type: msg.type });

  switch (msg.type) {
    case "join":
      log.info("Tab joining room", { roomId: msg.roomId });
      void joinRoom(msg.roomId);
      break;

    case "leave":
      removePort(port);
      break;

    case "broadcast":
      log.debug("Tab broadcasting", { portCount: ports.size });
      broadcastFromTab(port, msg.data);
      break;

    case "sendTo":
      signaling?.sendTo(msg.peerId, msg.data);
      break;

    case "setTimeOffset":
      signaling?.setPeerTimeOffset(msg.peerId, msg.offset);
      break;

    case "getState":
      sendToPort(port, { type: "state", state: getWorkerState() });
      break;
  }
}

/**
 * Join a room (connect signaling if not already connected)
 */
async function joinRoom(roomId: string): Promise<void> {
  // Already connected to this room
  if (currentRoomId === roomId && signaling?.state === "connected") {
    log.debug("Already connected to room", { roomId });
    return;
  }

  // Disconnect from previous room if different
  if (currentRoomId && currentRoomId !== roomId) {
    await disconnectSignaling();
  }

  currentRoomId = roomId;
  log.info("Joining room", { roomId });

  // Create signaling transport
  signaling = new SignalingTransport({
    enableWebRTC: true,
    autoReconnect: true,
  });

  // Wire up callbacks
  signaling.onMessage = handleRemoteMessage;

  signaling.onStateChange = (state) => {
    transportState = state;
    broadcastToAllTabs({ type: "stateChange", state });
  };

  signaling.onPeerConnect = (peerId) => {
    log.info("Remote peer connected", { peerId });
    broadcastToAllTabs({ type: "peerConnect", peerId });
  };

  signaling.onPeerDisconnect = (peerId) => {
    log.info("Remote peer disconnected", { peerId });
    broadcastToAllTabs({ type: "peerDisconnect", peerId });
  };

  try {
    await signaling.connect(roomId);
    log.info("Connected to room", { roomId, peerCount: signaling.getPeerCount() });
    // Notify all tabs that we've joined
    broadcastToAllTabs({ type: "joined", roomId });
  } catch (err) {
    log.error("Failed to connect to room", { roomId, error: err });
    broadcastToAllTabs({ type: "error", error: String(err) });
  }
}

/**
 * Handle message from remote peer
 */
function handleRemoteMessage(msg: SyncMessage): void {
  log.debug("Remote message received", {
    transport: msg.source.transport,
    peerId: msg.source.peerId,
    size: msg.data instanceof ArrayBuffer ? msg.data.byteLength : String(msg.data).length,
  });

  // Forward to all tabs
  for (const port of ports) {
    sendMessageToPort(port, msg);
  }
}

/**
 * Broadcast data from a tab to remote peers and other local tabs
 */
function broadcastFromTab(sourcePort: MessagePort, data: ArrayBuffer | string): void {
  const otherTabCount = ports.size - 1;
  log.debug("Broadcasting from tab", { otherTabCount, signalingConnected: signaling?.state === "connected" });

  // Send to remote peers
  if (signaling?.state === "connected") {
    signaling.broadcast(data);
  }

  // Send to other local tabs
  const localMsg: SyncMessage = {
    data,
    source: {
      transport: "broadcast",
      peerId: "local-tab",
      isLocalTab: true,
      timeOffset: 0,
    },
    receivedAt: performance.now(),
  };

  let sentCount = 0;
  for (const port of ports) {
    if (port !== sourcePort) {
      sendMessageToPort(port, localMsg);
      sentCount++;
    }
  }
  log.debug("Sent to other tabs", { sentCount });
}

/**
 * Send a SyncMessage to a port, handling transferables
 */
function sendMessageToPort(port: MessagePort, msg: SyncMessage): void {
  const workerMsg: WorkerToTabMessage = { type: "message", message: msg };

  if (msg.data instanceof ArrayBuffer) {
    // Clone the buffer for transfer (original may be needed by other ports)
    const clonedData = msg.data.slice(0);
    const clonedMsg: WorkerToTabMessage = {
      type: "message",
      message: { ...msg, data: clonedData },
    };
    port.postMessage(clonedMsg, [clonedData]);
  } else {
    port.postMessage(workerMsg);
  }
}

/**
 * Send a control message to a port
 */
function sendToPort(port: MessagePort, msg: WorkerToTabMessage): void {
  port.postMessage(msg);
}

/**
 * Broadcast a control message to all tabs
 */
function broadcastToAllTabs(msg: WorkerToTabMessage): void {
  for (const port of ports) {
    sendToPort(port, msg);
  }
}

/**
 * Remove a port and clean up if no tabs remain
 */
function removePort(port: MessagePort): void {
  ports.delete(port);
  log.info("Tab left", { tabCount: ports.size });

  // If no tabs remain, disconnect signaling to save resources
  if (ports.size === 0) {
    log.info("No tabs remaining, disconnecting");
    void disconnectSignaling();
  }
}

/**
 * Disconnect signaling transport
 */
async function disconnectSignaling(): Promise<void> {
  if (signaling) {
    await signaling.disconnect();
    signaling = null;
  }
  currentRoomId = null;
  transportState = "disconnected";
}

/**
 * Get current worker state for debugging
 */
function getWorkerState(): WorkerState {
  return {
    roomId: currentRoomId,
    transportState,
    peerCount: signaling?.getPeerCount() ?? 0,
    tabCount: ports.size,
  };
}
