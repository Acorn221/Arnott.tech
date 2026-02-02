import { Canvas } from "@react-three/fiber";
import {
  type FC,
  type InputHTMLAttributes,
  Suspense,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { OrbitControls, Environment } from "@react-three/drei";
import InteractiveSpinner from "./interactive-spinner";
import { useSyncRoom } from "@/lib/sync";
import {
  encodeSpinnerEvent,
  decodeSpinnerEvent,
  spinnerStateComputer,
  spinnerConflictResolver,
  type SpinnerEvent,
  type SpinnerState,
} from "./spinner-codec";
import { useSpinulation } from "./SpinulationContext";

// Test instrumentation
declare global {
  interface Window {
    __spinner_state__?: SpinnerState;
    __spinner_event__?: SpinnerEvent | null;
    __spinner_get_state__?: () => SpinnerState;
  }
}

/** Welcome spin velocity (radians/second) */
const WELCOME_SPIN_VELOCITY = 8;
/** Minimum time between welcome spins (ms) - short to allow rapid peer joins */
const WELCOME_SPIN_DEBOUNCE_MS = 500;
/** Velocity threshold - don't trigger welcome spin if already moving faster */
const WELCOME_SPIN_VELOCITY_THRESHOLD = 2;
/** Delay before sending welcome spin (ms) - gives connection time to stabilize */
const WELCOME_SPIN_DELAY_MS = 100;
/** Retry delay for welcome spin broadcast (ms) */
const WELCOME_SPIN_RETRY_DELAY_MS = 200;

const FidgetSpinner: FC<InputHTMLAttributes<HTMLDivElement>> = ({
  ...props
}) => {
  const { state, addSpins, getUpgradeEffect } = useSpinulation();
  const spinCount = state.spinCount;
  const speedMultiplier = getUpgradeEffect("bearingUpgrade");

  // Wrapper for InteractiveSpinner compatibility
  const setSpinCount = useCallback(
    (updater: React.SetStateAction<number>) => {
      if (typeof updater === "function") {
        // Extract the delta from the functional update
        const next = updater(spinCount);
        const delta = next - spinCount;
        if (delta > 0) addSpins(delta);
      }
    },
    [spinCount, addSpins],
  );

  // Current CRDT event (source of truth for spinner state)
  const currentEventRef = useRef<SpinnerEvent | null>(null);

  // Ref for broadcast function (avoids circular dependency with useSyncRoom)
  const broadcastRef = useRef<((data: ArrayBuffer) => void) | null>(null);

  // Debounce welcome spins
  const lastWelcomeSpinRef = useRef(0);

  // Handle incoming spinner events from peers
  const handleMessage = useCallback(
    (_data: ArrayBuffer, _peerId: string, timeOffset: number) => {
      const event = decodeSpinnerEvent(_data);
      if (!event) return;

      const adjustedEvent = spinnerConflictResolver.adjustTimestamp(
        event,
        timeOffset,
      );

      if (
        spinnerConflictResolver.shouldReplace(
          currentEventRef.current,
          adjustedEvent,
          timeOffset,
        )
      ) {
        currentEventRef.current = adjustedEvent;
      }
    },
    [],
  );

  // Share current state when any peer joins (local or remote)
  const handlePeerJoin = useCallback((_peerId: string, _isLocal: boolean) => {
    // Debounce to prevent spam when many peers join at once
    const joinTime = Date.now();
    if (joinTime - lastWelcomeSpinRef.current < WELCOME_SPIN_DEBOUNCE_MS)
      return;
    lastWelcomeSpinRef.current = joinTime;

    // Small delay to ensure connection is stable before sending
    setTimeout(() => {
      // Determine what to send: existing state or welcome spin
      let eventToSend: SpinnerEvent;

      if (currentEventRef.current) {
        const state = spinnerStateComputer.compute(
          currentEventRef.current,
          Date.now(),
        );
        // Only use existing event if spinner is still moving meaningfully
        if (Math.abs(state.velocity) > WELCOME_SPIN_VELOCITY_THRESHOLD) {
          eventToSend = currentEventRef.current;
        } else {
          // Spinner stopped, send a welcome spin
          eventToSend = {
            type: "release",
            timestamp: Date.now(),
            rotation: state.rotation, // Start from current position
            velocity: WELCOME_SPIN_VELOCITY,
          };
          currentEventRef.current = eventToSend;
        }
      } else {
        // No state, send a welcome spin
        eventToSend = {
          type: "release",
          timestamp: Date.now(),
          rotation: 0,
          velocity: WELCOME_SPIN_VELOCITY,
        };
        currentEventRef.current = eventToSend;
      }

      // Send immediately
      broadcastRef.current?.(encodeSpinnerEvent(eventToSend));

      // Retry once after delay for reliability (same event, same timestamp)
      setTimeout(() => {
        broadcastRef.current?.(encodeSpinnerEvent(eventToSend));
      }, WELCOME_SPIN_RETRY_DELAY_MS);
    }, WELCOME_SPIN_DELAY_MS);
  }, []);

  const { broadcast, isConnected, connectionState, peerInfo } = useSyncRoom({
    autoConnect: true,
    onMessage: handleMessage,
    onPeerJoin: handlePeerJoin,
  });

  // Keep broadcast ref updated
  broadcastRef.current = broadcast;

  // Emit CRDT events to all peers (binary encoded)
  const handleEventEmit = useCallback(
    (event: SpinnerEvent) => {
      currentEventRef.current = event;

      // Broadcast to all peers (transport manager handles local tabs + remote)
      if (isConnected) {
        broadcast(encodeSpinnerEvent(event));
      }
    },
    [isConnected, broadcast],
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
        timestamp: Date.now(),
        rotation,
      });
    },
    [handleEventEmit],
  );

  const drag = useCallback(
    (rotation: number, velocity: number) => {
      handleEventEmit({
        type: "drag",
        timestamp: Date.now(),
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
        timestamp: Date.now(),
        rotation,
        velocity,
      });
    },
    [handleEventEmit],
  );

  const isSynced = connectionState === "connected";

  // Test instrumentation - expose spinner state for E2E tests
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__spinner_get_state__ = () => {
        const event = currentEventRef.current;
        if (!event) return spinnerStateComputer.initialState();
        return spinnerStateComputer.compute(event, Date.now());
      };
      window.__spinner_event__ = currentEventRef.current;
    }
    return () => {
      if (typeof window !== "undefined") {
        delete window.__spinner_state__;
        delete window.__spinner_event__;
        delete window.__spinner_get_state__;
      }
    };
  }, []);

  return (
    <div {...props}>
      <div className="flex w-full justify-center align-middle gap-4 items-center">
        <div className="m-auto flex items-center gap-4">
          <span>Spins: {spinCount}</span>
          {isConnected && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Synced
              {peerInfo.total > 0 && (
                <>
                  {" - "}
                  {peerInfo.total} other{peerInfo.total !== 1 ? "s" : ""}
                  {peerInfo.remoteTransport === "mixed" && (
                    <> - WebRTC + WebSocket</>
                  )}
                  {peerInfo.remoteTransport === "webrtc" && <> - WebRTC</>}
                  {peerInfo.remoteTransport === "websocket" && (
                    <> - WebSocket</>
                  )}
                </>
              )}
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
            speedMultiplier={speedMultiplier}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default FidgetSpinner;
