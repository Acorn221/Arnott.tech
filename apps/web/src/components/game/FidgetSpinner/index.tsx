import { Canvas } from "@react-three/fiber";
import {
  type FC,
  type InputHTMLAttributes,
  Suspense,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";
import { OrbitControls, Environment } from "@react-three/drei";
import InteractiveSpinner from "./interactive-spinner";
import HighSpeedRenderer from "./HighSpeedRenderer";
import { useSyncRoom } from "@/lib/sync";
import {
  encodeSpinnerEvent,
  decodeSpinnerEvent,
  spinnerStateComputer,
  spinnerConflictResolver,
  type SpinnerEvent,
  type SpinnerState,
} from "./spinner-codec";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addSpins,
  selectSpinCount,
  selectUpgradeEffect,
  selectUpgradeLevel,
  selectAutoSpinUnlocked,
  selectAutoSpinLevel,
} from "@/store/slices/gameSlice";

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

/** Cooldown after user spin before auto-spin kicks in (ms) */
const AUTO_SPIN_COOLDOWN = 5000;
/** Auto spin intervals by level (ms) - faster at higher levels */
const AUTO_SPIN_INTERVALS = [1000, 800, 650, 500, 400, 300, 200, 150];
/** Auto spin velocity boosts by level (radians/second) - top 3 levels exceed manual spinning */
const AUTO_SPIN_BOOSTS = [4, 5, 6, 8, 10, 25, 35, 50];

/** Scene content wrapper - conditionally uses HighSpeedRenderer */
interface SceneContentProps {
  enableHighSpeedRenderer: boolean;
  velocityRef: React.MutableRefObject<number>;
  setSpinCount: (updater: React.SetStateAction<number>) => void;
  computeState: (now: number) => SpinnerState;
  grab: (rotation: number) => void;
  drag: (rotation: number, velocity: number) => void;
  release: (rotation: number, velocity: number) => void;
  isSynced: boolean;
  speedMultiplier: number;
  rgbLevel: number;
  isDraggingRef: React.MutableRefObject<boolean>;
  autoSpinPulse: boolean;
  handleVelocityChange: (velocity: number) => void;
}

const SceneContent: FC<SceneContentProps> = ({
  enableHighSpeedRenderer,
  velocityRef,
  setSpinCount,
  computeState,
  grab,
  drag,
  release,
  isSynced,
  speedMultiplier,
  rgbLevel,
  isDraggingRef,
  autoSpinPulse,
  handleVelocityChange,
}) => {
  const content = (
    <>
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
          rgbLevel={rgbLevel}
          isDraggingRef={isDraggingRef}
          autoSpinPulse={autoSpinPulse}
          onVelocityChange={handleVelocityChange}
        />
      </Suspense>
    </>
  );

  if (enableHighSpeedRenderer) {
    return (
      <HighSpeedRenderer speed={velocityRef} speedThreshold={30}>
        {content}
      </HighSpeedRenderer>
    );
  }

  return content;
};

interface FidgetSpinnerProps extends InputHTMLAttributes<HTMLDivElement> {
  /** Disable WebRTC sync (for standalone/stimulation mode) */
  disableSync?: boolean;
  /** Hide the status bar with spin count and sync info */
  hideStatusBar?: boolean;
  /** Enable auto-spin feature (requires upgrade) */
  enableAutoSpin?: boolean;
  /** Enable high-speed renderer with frame caching and motion blur */
  enableHighSpeedRenderer?: boolean;
}

const FidgetSpinner: FC<FidgetSpinnerProps> = ({
  disableSync = false,
  hideStatusBar = false,
  enableAutoSpin = false,
  enableHighSpeedRenderer = false,
  ...props
}) => {
  const dispatch = useAppDispatch();
  const spinCount = useAppSelector(selectSpinCount);
  const speedMultiplier = useAppSelector(selectUpgradeEffect("bearingUpgrade"));
  const rgbLevel = useAppSelector(selectUpgradeLevel("rgbMode"));
  const rgbMultiplier = useAppSelector(selectUpgradeEffect("rgbMode"));
  const theoMultiplier = useAppSelector(selectUpgradeEffect("theoMode"));
  const spinMultiplier = rgbMultiplier * theoMultiplier; // Stack multipliers
  const autoSpinUnlocked = useAppSelector(selectAutoSpinUnlocked);
  const autoSpinLevel = useAppSelector(selectAutoSpinLevel);

  // Track if user is currently dragging (to avoid interfering with auto-spin)
  const isDraggingRef = useRef(false);
  // Track last user spin time (to cooldown auto-spin after user interaction)
  const lastUserSpinRef = useRef(0);
  // Visual pulse when auto-spin triggers
  const [autoSpinPulse, setAutoSpinPulse] = useState(false);
  // Track previous auto-spin level to detect upgrades
  const prevAutoSpinLevelRef = useRef(autoSpinLevel);
  // Track current angular velocity for high-speed renderer (ref to avoid re-renders)
  const velocityRef = useRef(0);

  // Update velocity ref (no re-renders needed - HighSpeedRenderer reads from useFrame)
  const handleVelocityChange = useCallback((velocity: number) => {
    velocityRef.current = velocity;
  }, []);

  // Reset cooldown and trigger immediate spin when auto-spin is upgraded
  useEffect(() => {
    if (autoSpinLevel > prevAutoSpinLevelRef.current && enableAutoSpin) {
      // Reset cooldown so auto-spin starts immediately
      lastUserSpinRef.current = 0;
    }
    prevAutoSpinLevelRef.current = autoSpinLevel;
  }, [autoSpinLevel, enableAutoSpin]);

  // Wrapper for InteractiveSpinner compatibility
  const setSpinCount = useCallback(
    (updater: React.SetStateAction<number>) => {
      if (typeof updater === "function") {
        // Extract the delta from the functional update
        const next = updater(spinCount);
        const delta = next - spinCount;
        if (delta > 0) dispatch(addSpins(Math.floor(delta * spinMultiplier)));
      }
    },
    [spinCount, dispatch, spinMultiplier],
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
    autoConnect: !disableSync,
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
      // Track user spin time for auto-spin cooldown
      lastUserSpinRef.current = Date.now();
      handleEventEmit({
        type: "release",
        timestamp: Date.now(),
        rotation,
        velocity,
      });
    },
    [handleEventEmit],
  );

  // Internal boost for auto-spin (doesn't trigger cooldown)
  const autoSpinBoost = useCallback(
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

  // Auto-spin effect - boosts velocity periodically without interfering with user
  useEffect(() => {
    if (!enableAutoSpin || !autoSpinUnlocked || autoSpinLevel === 0) return;

    const levelIndex = Math.min(autoSpinLevel - 1, AUTO_SPIN_INTERVALS.length - 1);
    const spinInterval = AUTO_SPIN_INTERVALS[levelIndex];
    const velocityBoost = AUTO_SPIN_BOOSTS[levelIndex];

    const interval = setInterval(() => {
      // Don't interfere if user is dragging
      if (isDraggingRef.current) return;

      // Don't boost if user recently spun (10s cooldown)
      if (Date.now() - lastUserSpinRef.current < AUTO_SPIN_COOLDOWN) return;

      const state = computeState(Date.now());
      // Boost velocity in the current direction, or start spinning if stopped
      const currentVelocity = state.velocity || 0;
      const wasStatic = Math.abs(currentVelocity) < 1;
      const newVelocity = currentVelocity + velocityBoost * (currentVelocity >= 0 ? 1 : -1);
      autoSpinBoost(state.rotation, newVelocity);

      // Only show wind animation when going from static to spinning
      if (wasStatic) {
        setAutoSpinPulse(true);
        setTimeout(() => setAutoSpinPulse(false), 500);
      }
    }, spinInterval);

    return () => clearInterval(interval);
  }, [enableAutoSpin, autoSpinUnlocked, autoSpinLevel, computeState, autoSpinBoost]);

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
      {!hideStatusBar && (
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
      )}
      <Canvas
        camera={{
          position: [0, 4, 0],
          fov: 24,
          rotation: [-Math.PI / 2, 0, 0],
        }}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <SceneContent
          enableHighSpeedRenderer={enableHighSpeedRenderer}
          velocityRef={velocityRef}
          setSpinCount={setSpinCount}
          computeState={computeState}
          grab={grab}
          drag={drag}
          release={release}
          isSynced={isSynced}
          speedMultiplier={speedMultiplier}
          rgbLevel={rgbLevel}
          isDraggingRef={isDraggingRef}
          autoSpinPulse={autoSpinPulse}
          handleVelocityChange={handleVelocityChange}
        />
      </Canvas>
    </div>
  );
};

export default FidgetSpinner;
