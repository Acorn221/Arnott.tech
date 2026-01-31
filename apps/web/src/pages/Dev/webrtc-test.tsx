import { type FC, useState, useRef, useCallback, useEffect } from "react";

const POLL_INTERVAL = 500; // Faster polling for testing
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  connected: boolean;
  remoteDescriptionSet: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

interface Signal {
  type: string;
  from: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

interface JoinResponse {
  peerId?: string;
  peers?: string[];
}

interface PollResponse {
  signals?: Signal[];
}

const WebRTCTest: FC = () => {
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [peerConnections, setPeerConnections] = useState<
    Map<string, PeerConnection>
  >(new Map());
  const [messages, setMessages] = useState<
    { from: string; text: string; time: string }[]
  >([]);
  const [inputMessage, setInputMessage] = useState("");
  const [log, setLog] = useState<string[]>([]);

  // Refs for values that need to be current in callbacks
  const myPeerIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [...prev.slice(-50), `[${time}] ${message}`]);
  }, []);

  const addMessage = useCallback(
    (from: string, text: string) => {
      const time = new Date().toLocaleTimeString();
      setMessages((prev) => [...prev.slice(-100), { from, text, time }]);
      addLog(`Message from ${from}: ${text}`);
    },
    [addLog],
  );

  const sendSignal = useCallback(
    async <T,>(
      endpoint: string,
      data: Record<string, unknown>,
    ): Promise<T | null> => {
      try {
        const res = await fetch(`/api/signal/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        return (await res.json()) as T;
      } catch (err) {
        addLog(`Signal error: ${String(err)}`);
        return null;
      }
    },
    [addLog],
  );

  // Process any queued ICE candidates after remote description is set
  const processPendingCandidates = useCallback(
    async (peerConn: PeerConnection) => {
      if (peerConn.pendingCandidates.length > 0) {
        addLog(
          `Processing ${String(peerConn.pendingCandidates.length)} queued ICE candidates for ${peerConn.peerId}`,
        );
        for (const candidate of peerConn.pendingCandidates) {
          try {
            await peerConn.connection.addIceCandidate(candidate);
          } catch (err) {
            addLog(`Error adding queued ICE candidate: ${String(err)}`);
          }
        }
        peerConn.pendingCandidates = [];
      }
    },
    [addLog],
  );

  const createPeerConnection = useCallback(
    (
      localPeerId: string,
      remotePeerId: string,
      isInitiator: boolean,
    ): PeerConnection => {
      addLog(
        `Creating peer connection to ${remotePeerId} (initiator: ${String(isInitiator)})`,
      );

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      let dataChannel: RTCDataChannel | null = null;

      const peerConn: PeerConnection = {
        peerId: remotePeerId,
        connection: pc,
        dataChannel: null,
        connected: false,
        remoteDescriptionSet: false,
        pendingCandidates: [],
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const c = event.candidate;
          addLog(`Sending ICE to ${remotePeerId}: ${c.type ?? "unknown"} ${c.address ?? ""}:${String(c.port ?? "")}`);
          void sendSignal("ice", {
            from: localPeerId,
            to: remotePeerId,
            candidate: event.candidate.toJSON(),
          });
        } else {
          addLog(`ICE gathering complete for ${remotePeerId}`);
        }
      };

      pc.onicegatheringstatechange = () => {
        addLog(`ICE gathering state with ${remotePeerId}: ${pc.iceGatheringState}`);
      };

      pc.oniceconnectionstatechange = () => {
        addLog(`ICE connection state with ${remotePeerId}: ${pc.iceConnectionState}`);
        // Also check if we should mark connected via ICE state (fallback)
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          peerConn.connected = true;
          setPeerConnections(
            (prev) => new Map(prev).set(remotePeerId, peerConn),
          );
        }
      };

      pc.onsignalingstatechange = () => {
        addLog(`Signaling state with ${remotePeerId}: ${pc.signalingState}`);
      };

      pc.onconnectionstatechange = () => {
        addLog(`Connection state with ${remotePeerId}: ${pc.connectionState}`);
        if (pc.connectionState === "connected") {
          peerConn.connected = true;
          setPeerConnections(
            (prev) => new Map(prev).set(remotePeerId, peerConn),
          );
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          peerConn.connected = false;
          setPeerConnections(
            (prev) => new Map(prev).set(remotePeerId, peerConn),
          );
        }
      };

      // Setup data channel
      const setupDataChannel = (channel: RTCDataChannel) => {
        channel.onopen = () => {
          addLog(`Data channel opened with ${remotePeerId}`);
          peerConn.dataChannel = channel;
          peerConn.connected = true;
          setPeerConnections(
            (prev) => new Map(prev).set(remotePeerId, peerConn),
          );
        };

        channel.onclose = () => {
          addLog(`Data channel closed with ${remotePeerId}`);
          peerConn.connected = false;
          setPeerConnections(
            (prev) => new Map(prev).set(remotePeerId, peerConn),
          );
        };

        channel.onmessage = (event: MessageEvent<string>) => {
          addMessage(remotePeerId, event.data);
        };
      };

      if (isInitiator) {
        dataChannel = pc.createDataChannel("chat");
        setupDataChannel(dataChannel);
        peerConn.dataChannel = dataChannel;
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel);
        };
      }

      peerConnectionsRef.current.set(remotePeerId, peerConn);
      setPeerConnections(new Map(peerConnectionsRef.current));

      return peerConn;
    },
    [addLog, addMessage, sendSignal],
  );

  const initiateConnection = useCallback(
    async (localPeerId: string, remotePeerId: string) => {
      const peerConn = createPeerConnection(localPeerId, remotePeerId, true);

      try {
        const offer = await peerConn.connection.createOffer();
        await peerConn.connection.setLocalDescription(offer);

        addLog(`Sending offer to ${remotePeerId}`);
        await sendSignal("offer", {
          from: localPeerId,
          to: remotePeerId,
          sdp: offer.sdp,
        });
      } catch (err) {
        addLog(`Error creating offer: ${String(err)}`);
      }
    },
    [createPeerConnection, addLog, sendSignal],
  );

  const handleSignal = useCallback(
    async (localPeerId: string, signal: Signal) => {
      const { type, from, sdp, candidate } = signal;
      addLog(`Received ${type} from ${from}`);

      let peerConn = peerConnectionsRef.current.get(from);

      if (type === "offer") {
        // Create peer connection if it doesn't exist
        if (!peerConn) {
          peerConn = createPeerConnection(localPeerId, from, false);
        }

        try {
          await peerConn.connection.setRemoteDescription({
            type: "offer",
            sdp,
          });
          peerConn.remoteDescriptionSet = true;

          // Process any ICE candidates that arrived before the offer
          await processPendingCandidates(peerConn);

          const answer = await peerConn.connection.createAnswer();
          await peerConn.connection.setLocalDescription(answer);

          addLog(`Sending answer to ${from}`);
          await sendSignal("answer", {
            from: localPeerId,
            to: from,
            sdp: answer.sdp,
          });
        } catch (err) {
          addLog(`Error handling offer: ${String(err)}`);
        }
      } else if (type === "answer") {
        if (peerConn) {
          try {
            await peerConn.connection.setRemoteDescription({
              type: "answer",
              sdp,
            });
            peerConn.remoteDescriptionSet = true;

            // Process any ICE candidates that arrived before the answer
            await processPendingCandidates(peerConn);
          } catch (err) {
            addLog(`Error handling answer: ${String(err)}`);
          }
        }
      } else if (type === "ice") {
        if (candidate) {
          const candidateStr = candidate.candidate ?? "";
          const candidateType = candidateStr.includes("typ host")
            ? "host"
            : candidateStr.includes("typ srflx")
              ? "srflx"
              : candidateStr.includes("typ relay")
                ? "relay"
                : "unknown";
          addLog(`Received ICE from ${from}: ${candidateType}`);

          if (peerConn?.remoteDescriptionSet) {
            // Remote description is set, add candidate immediately
            try {
              await peerConn.connection.addIceCandidate(candidate);
              addLog(`Added ICE candidate from ${from}`);
            } catch (err) {
              addLog(`Error adding ICE candidate: ${String(err)}`);
            }
          } else if (peerConn) {
            // Queue candidate until remote description is set
            addLog(`Queuing ICE candidate from ${from} (no remote description yet)`);
            peerConn.pendingCandidates.push(candidate);
          } else {
            // No peer connection yet - create one and queue the candidate
            addLog(`Creating peer connection for early ICE from ${from}`);
            peerConn = createPeerConnection(localPeerId, from, false);
            peerConn.pendingCandidates.push(candidate);
          }
        }
      }
    },
    [createPeerConnection, addLog, sendSignal, processPendingCandidates],
  );

  const pollSignals = useCallback(async () => {
    const peerId = myPeerIdRef.current;
    if (!peerId) return;

    try {
      const res = await fetch(`/api/signal/poll/${peerId}`);
      const data = (await res.json()) as PollResponse;

      if (data.signals && data.signals.length > 0) {
        addLog(`Poll received ${String(data.signals.length)} signal(s): ${data.signals.map((s) => s.type).join(", ")}`);
        for (const signal of data.signals) {
          await handleSignal(peerId, signal);
        }
      }
    } catch {
      // Silently fail for polling errors
    }
  }, [handleSignal, addLog]);

  const cleanup = useCallback(() => {
    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Close all peer connections
    for (const [, peerConn] of peerConnectionsRef.current) {
      peerConn.dataChannel?.close();
      peerConn.connection.close();
    }
    peerConnectionsRef.current.clear();
    setPeerConnections(new Map());
  }, []);

  const joinRoom = useCallback(async () => {
    addLog("Joining room...");

    const result = await sendSignal<JoinResponse>("join", {
      roomId: "default",
    });
    if (!result?.peerId) {
      addLog("Failed to join room");
      return;
    }

    const peerId = result.peerId;

    // Update both state and ref
    myPeerIdRef.current = peerId;
    setMyPeerId(peerId);
    setJoined(true);
    addLog(`Joined as ${peerId}`);

    // Connect to existing peers using the peerId we just got
    if (result.peers && result.peers.length > 0) {
      addLog(`Found ${String(result.peers.length)} existing peer(s)`);
      for (const remotePeerId of result.peers) {
        // Small delay between connections
        await new Promise((r) => setTimeout(r, 100));
        await initiateConnection(peerId, remotePeerId);
      }
    }

    // Start polling for signals
    pollIntervalRef.current = window.setInterval(() => {
      void pollSignals();
    }, POLL_INTERVAL);
  }, [addLog, sendSignal, initiateConnection, pollSignals]);

  const leaveRoom = useCallback(async () => {
    addLog("Leaving room...");

    cleanup();

    // Signal leave
    const peerId = myPeerIdRef.current;
    if (peerId) {
      await sendSignal("leave", { roomId: "default", peerId });
    }

    myPeerIdRef.current = null;
    setMyPeerId(null);
    setJoined(false);
    addLog("Left room");
  }, [addLog, sendSignal, cleanup]);

  const sendMessage = useCallback(() => {
    if (!inputMessage.trim()) return;

    let sentCount = 0;
    for (const [, peerConn] of peerConnectionsRef.current) {
      if (peerConn.dataChannel?.readyState === "open") {
        peerConn.dataChannel.send(inputMessage);
        sentCount++;
      }
    }

    if (sentCount > 0) {
      addMessage("me", inputMessage);
      addLog(`Sent message to ${String(sentCount)} peer(s)`);
    } else {
      addLog("No connected peers to send to");
    }

    setInputMessage("");
  }, [inputMessage, addMessage, addLog]);

  // Handle page unload - use sendBeacon for reliable delivery
  useEffect(() => {
    const handleBeforeUnload = () => {
      const peerId = myPeerIdRef.current;
      if (peerId) {
        // Use sendBeacon for reliable delivery on page close
        navigator.sendBeacon(
          "/api/signal/leave",
          JSON.stringify({ roomId: "default", peerId }),
        );
      }
      cleanup();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const connectedPeers = Array.from(peerConnections.values()).filter(
    (p) => p.connected,
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">WebRTC P2P Test</h1>

        {/* Status */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`w-3 h-3 rounded-full ${joined ? "bg-green-500" : "bg-red-500"}`}
            />
            <span>
              {joined ? `Connected as: ${myPeerId}` : "Not connected"}
            </span>
          </div>

          <div className="flex gap-4">
            {!joined ? (
              <button
                onClick={() => void joinRoom()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                Join Room
              </button>
            ) : (
              <button
                onClick={() => void leaveRoom()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                Leave Room
              </button>
            )}
          </div>
        </div>

        {/* Connected Peers */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-3">
            Connected Peers ({connectedPeers.length})
          </h2>
          {connectedPeers.length === 0 ? (
            <p className="text-gray-400">No peers connected</p>
          ) : (
            <ul className="space-y-2">
              {connectedPeers.map((peer) => (
                <li
                  key={peer.peerId}
                  className="flex items-center gap-2 text-green-400"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  {peer.peerId}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Chat */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-3">Messages (P2P)</h2>
          <div className="h-48 overflow-y-auto bg-gray-900 rounded p-3 mb-3 font-mono text-sm">
            {messages.length === 0 ? (
              <p className="text-gray-500">No messages yet</p>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className="mb-1">
                  <span className="text-gray-500">[{msg.time}]</span>{" "}
                  <span
                    className={
                      msg.from === "me" ? "text-blue-400" : "text-green-400"
                    }
                  >
                    {msg.from}:
                  </span>{" "}
                  {msg.text}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              disabled={connectedPeers.length === 0}
              className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={connectedPeers.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>

        {/* Debug Log */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3">Debug Log</h2>
          <div className="h-48 overflow-y-auto bg-gray-900 rounded p-3 font-mono text-xs">
            {log.map((line, i) => (
              <div key={i} className="text-gray-400">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebRTCTest;
