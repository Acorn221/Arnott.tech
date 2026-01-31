import { Canvas } from "@react-three/fiber";
import {
  type FC,
  type InputHTMLAttributes,
  Suspense,
  useState,
  useCallback,
  useRef,
} from "react";
import { OrbitControls, Environment } from "@react-three/drei";
import InteractiveSpinner from "./interactive-spinner";
import { useWebRTCRoom } from "@/hooks/useWebRTCRoom";
import { useBroadcastChannel } from "@/lib/sync/useBroadcastChannel";
import {
  encodeSpinnerEvent,
  decodeSpinnerEvent,
  spinnerStateComputer,
  spinnerConflictResolver,
  type SpinnerEvent,
} from "./spinner-codec";

// JSON message types (binary used for spinner events)
type SpinnerMessage =
  | { type: "sync"; event: SpinnerEvent }
  | { type: "time-sync"; localTime: number };

// BroadcastChannel message type for local tab sync
interface LocalTabMessage {
  event: SpinnerEvent;
  sourceTabId: string;
}

// Generate unique tab ID
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Disable inter-tab sync in dev for easier testing
const ENABLE_LOCAL_TAB_SYNC = !(import.meta.env.VITE_PUBLIC_DEV == "true");

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => {
  const [spinCount, setSpinCount] = useState(0);
  const timeOffsetsRef = useRef<Map<string, number>>(new Map());

  // Current CRDT event
  const currentEventRef = useRef<SpinnerEvent | null>(null);
  const timeOffsetRef = useRef(0);

  // Create refs for WebRTC methods to avoid circular deps
  const webrtcRef = useRef<{
    sendTo: (peerId: string, data: unknown) => void;
    broadcast: (data: unknown) => void;
  } | null>(null);

  // Handle incoming CRDT messages
  const handleMessage = useCallback((peerId: string, data: unknown) => {
    // Binary spinner events (fast path)
    if (data instanceof ArrayBuffer) {
      const event = decodeSpinnerEvent(data);
      if (event) {
        // Apply time offset
        const offset = timeOffsetsRef.current.get(peerId) ?? 0;
        const adjustedEvent = spinnerConflictResolver.adjustTimestamp(
          event,
          offset,
        );

        if (
          spinnerConflictResolver.shouldReplace(
            currentEventRef.current,
            adjustedEvent,
            offset,
          )
        ) {
          currentEventRef.current = adjustedEvent;
        }
      }
      return;
    }

    // JSON messages (time-sync, sync)
    const msg = data as SpinnerMessage;

    if (msg.type === "time-sync") {
      const offset = performance.now() - msg.localTime;
      timeOffsetsRef.current.set(peerId, offset);
      // Use average offset
      const offsets = Array.from(timeOffsetsRef.current.values());
      timeOffsetRef.current =
        offsets.reduce((a, b) => a + b, 0) / offsets.length;
      return;
    }

    if (msg.type === "sync" && msg.event) {
      const offset = timeOffsetsRef.current.get(peerId) ?? 0;
      const adjustedEvent = spinnerConflictResolver.adjustTimestamp(
        msg.event,
        offset,
      );
      if (
        spinnerConflictResolver.shouldReplace(
          currentEventRef.current,
          adjustedEvent,
          offset,
        )
      ) {
        currentEventRef.current = adjustedEvent;
      }
    }
  }, []);

  // Handle new peer connections - exchange time sync and current state
  const handlePeerConnect = useCallback((peerId: string) => {
    // Send time sync for timestamp alignment
    webrtcRef.current?.sendTo(peerId, {
      type: "time-sync",
      localTime: performance.now(),
    } as SpinnerMessage);

    // Send current state if we have any - conflict resolver will pick the winner
    const currentEvent = currentEventRef.current;
    if (currentEvent) {
      webrtcRef.current?.sendTo(peerId, {
        type: "sync",
        event: currentEvent,
      } as SpinnerMessage);
    }
  }, []);

  const { broadcast, sendTo, isConnected, peerCount, connectionState } =
    useWebRTCRoom({
      roomId: "spinner",
      autoConnect: true,
      autoReconnect: true,
      onMessage: handleMessage,
      onPeerConnect: handlePeerConnect,
    });

  // Store webrtc methods in ref (sync, not useEffect, to avoid race condition)
  webrtcRef.current = { sendTo, broadcast };

  // Handle local tab messages (via BroadcastChannel)
  const handleLocalTabMessage = useCallback((data: LocalTabMessage) => {
    // Ignore messages from self
    if (data.sourceTabId === TAB_ID) {
      return;
    }

    const event = data.event;
    // No time offset needed for same-device tabs
    if (
      spinnerConflictResolver.shouldReplace(currentEventRef.current, event, 0)
    ) {
      currentEventRef.current = event;
    }
  }, []);

  // BroadcastChannel for instant same-browser tab sync
  const { broadcast: localBroadcast } = useBroadcastChannel<LocalTabMessage>({
    channelName: "spinner-sync",
    onMessage: handleLocalTabMessage,
    enabled: ENABLE_LOCAL_TAB_SYNC,
  });

  // Emit CRDT events to all peers (binary encoded) and local tabs
  const handleEventEmit = useCallback(
    (event: SpinnerEvent) => {
      currentEventRef.current = event;

      // 1. Broadcast to other tabs (instant, ~1ms)
      localBroadcast({ event, sourceTabId: TAB_ID });

      // 2. Broadcast to WebRTC peers (cross-device)
      if (isConnected && peerCount > 0) {
        broadcast(encodeSpinnerEvent(event));
      }
    },
    [isConnected, peerCount, broadcast, localBroadcast],
  );

  // Compute state from current event
  const computeState = useCallback((now: number) => {
    const event = currentEventRef.current;
    if (!event) {
      return spinnerStateComputer.initialState();
    }
    return spinnerStateComputer.compute(event, now);
  }, []);

  // CRDT action methods
  const grab = useCallback(
    (rotation: number) => {
      handleEventEmit({
        type: "grab",
        timestamp: performance.now(),
        rotation,
      });
    },
    [handleEventEmit],
  );

  const drag = useCallback(
    (rotation: number, velocity: number) => {
      handleEventEmit({
        type: "drag",
        timestamp: performance.now(),
        rotation,
        velocity,
      });
    },
    [handleEventEmit],
  );

  const release = useCallback(
    (rotation: number, velocity: number) => {
      handleEventEmit({
        type: "release",
        timestamp: performance.now(),
        rotation,
        velocity,
      });
    },
    [handleEventEmit],
  );

  // isSynced = connected to room
  const isSynced = connectionState === "connected";

  return (
    <div {...props}>
      <div className="flex w-full justify-center align-middle gap-4 items-center">
        <div className="m-auto flex items-center gap-4">
          <span>Spins: {spinCount}</span>
          {peerCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {peerCount + 1} online
            </span>
          )}
        </div>
      </div>
      <Canvas
        camera={{
          position: [0, 4, 0],
          fov: 24,
          rotation: [-Math.PI / 2, 0, 0],
        }}
        shadows
        gl={{ antialias: true }}
      >
        <Environment files="/empty_warehouse_01_1k.hdr" background={false} />
        <ambientLight intensity={0.2} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 4}
        />
        <Suspense fallback={null}>
          <InteractiveSpinner
            position={[0, 0, 0]}
            scale={20}
            setSpinCount={setSpinCount}
            computeState={computeState}
            onGrab={grab}
            onDrag={drag}
            onRelease={release}
            isSynced={isSynced}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default FidgetSpinner;
