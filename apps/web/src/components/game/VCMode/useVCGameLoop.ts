import { useCallback, useEffect, useRef, useState } from 'react';

import startupsData from './startups.json';
import {
  type Investment,
  isExitEvent,
  isFundingEvent,
  type PendingRound,
  type Startup,
  type StartupsData,
} from './types';

// Time settings: ~5 minute full playthrough
const BASE_DAYS_PER_SECOND = 28;
const PENDING_ROUND_WINDOW_DAYS = 180; // ~6 seconds at 1x speed

export interface VCState {
  currentDay: number;
  isRunning: boolean;
  speed: number;
  investments: Investment[];
  pendingRounds: PendingRound[];
  gameOver: boolean;
  totalReturned: number;
  totalInvested: number;
  exitedStartups: Map<string, { outcome: string; returnMultiple: number }>;
}

interface UseVCGameLoopProps {
  onSpinsReturned: (amount: number) => void;
  onInvest: (amount: number) => void;
  getSpinCount: () => number;
}

interface UseVCGameLoopReturn {
  state: VCState;
  currentDate: Date;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  setSpeed: (speed: number) => void;
  invest: (startupId: string, amount: number) => void;
  passOnRound: (startupId: string) => void;
  getStartupById: (id: string) => Startup | undefined;
  getStartupValuation: (startupId: string) => number;
  resetGame: () => void;
}

const GAME_START_DATE = new Date('2003-01-01');
const GAME_END_DATE = new Date(); // Current date

const dateToDays = (date: Date): number => {
  return Math.floor((date.getTime() - GAME_START_DATE.getTime()) / (1000 * 60 * 60 * 24));
};

const daysToDate = (days: number): Date => {
  return new Date(GAME_START_DATE.getTime() + days * 24 * 60 * 60 * 1000);
};

const parseStartups = (): Startup[] => {
  const data = startupsData as StartupsData;
  return data.startups.map((startup) => ({
    ...startup,
    events: [...startup.events].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ),
  }));
};

export const useVCGameLoop = ({
  onSpinsReturned,
  onInvest,
  getSpinCount,
}: UseVCGameLoopProps): UseVCGameLoopReturn => {
  const startups = useRef<Startup[]>(parseStartups());
  const processedEvents = useRef<Set<string>>(new Set());
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [state, setState] = useState<VCState>({
    currentDay: 0,
    isRunning: false,
    speed: 1,
    investments: [],
    pendingRounds: [],
    gameOver: false,
    totalReturned: 0,
    totalInvested: 0,
    exitedStartups: new Map(),
  });

  const getStartupById = useCallback((id: string): Startup | undefined => {
    return startups.current.find((s) => s.id === id);
  }, []);

  const getStartupValuation = useCallback(
    (startupId: string): number => {
      const startup = getStartupById(startupId);
      if (!startup) return 0;

      const currentDate = daysToDate(state.currentDay);
      let lastValuation = 0;

      for (const event of startup.events) {
        const eventDate = new Date(event.date);
        if (eventDate > currentDate) break;

        if (isFundingEvent(event)) {
          lastValuation = event.valuation;
        } else if (isExitEvent(event)) {
          lastValuation = event.finalValuation;
        }
      }

      return lastValuation;
    },
    [state.currentDay, getStartupById]
  );

  const processGameDay = useCallback(
    (currentDay: number, prevState: VCState): VCState => {
      let newState = { ...prevState };

      for (const startup of startups.current) {
        for (let eventIndex = 0; eventIndex < startup.events.length; eventIndex++) {
          const event = startup.events[eventIndex];
          const eventDate = new Date(event.date);
          const eventDay = dateToDays(eventDate);
          const eventKey = `${startup.id}-${eventIndex}`;

          if (processedEvents.current.has(eventKey)) continue;

          if (eventDay <= currentDay) {
            processedEvents.current.add(eventKey);

            if (isFundingEvent(event)) {
              // Apply dilution to existing investments
              const hasInvestment = newState.investments.some(
                (inv) => inv.startupId === startup.id
              );

              if (hasInvestment) {
                const preMoneyValuation = event.valuation - event.raised;
                newState = {
                  ...newState,
                  investments: newState.investments.map((inv) => {
                    if (inv.startupId === startup.id) {
                      const dilutionFactor = preMoneyValuation / event.valuation;
                      return {
                        ...inv,
                        sharesOwned: inv.sharesOwned * dilutionFactor,
                      };
                    }
                    return inv;
                  }),
                };
              }

              // Add to pending rounds
              const newPendingRound: PendingRound = {
                startupId: startup.id,
                event: event,
                createdAtDay: currentDay,
                expiresAtDay: currentDay + PENDING_ROUND_WINDOW_DAYS,
              };

              newState = {
                ...newState,
                pendingRounds: [...newState.pendingRounds, newPendingRound],
              };
            } else if (isExitEvent(event)) {
              const exitingInvestments = newState.investments.filter(
                (inv) => inv.startupId === startup.id
              );

              let totalReturn = 0;
              for (const inv of exitingInvestments) {
                const returnValue = (inv.sharesOwned / 100) * event.finalValuation;
                totalReturn += returnValue;
              }

              const totalInvested = exitingInvestments.reduce(
                (sum, inv) => sum + inv.amountInvested,
                0
              );
              const returnMultiple = totalInvested > 0 ? totalReturn / totalInvested : 0;

              const newExitedStartups = new Map(newState.exitedStartups);
              if (totalInvested > 0) {
                newExitedStartups.set(startup.id, {
                  outcome: event.outcome,
                  returnMultiple,
                });
              }

              newState = {
                ...newState,
                investments: newState.investments.filter(
                  (inv) => inv.startupId !== startup.id
                ),
                totalReturned: newState.totalReturned + totalReturn,
                exitedStartups: newExitedStartups,
              };

              if (totalReturn > 0) {
                onSpinsReturned(Math.floor(totalReturn));
              }

              // Remove pending rounds for exited startup
              newState = {
                ...newState,
                pendingRounds: newState.pendingRounds.filter(
                  (pr) => pr.startupId !== startup.id
                ),
              };
            }
          }
        }
      }

      // Remove pending rounds that expired more than 50 days ago (gives time to show 0%)
      newState = {
        ...newState,
        pendingRounds: newState.pendingRounds.filter((pr) => pr.expiresAtDay > currentDay - 50),
      };

      return newState;
    },
    [onSpinsReturned]
  );

  const checkGameOver = useCallback((currentDay: number): boolean => {
    const endDay = dateToDays(GAME_END_DATE);
    return currentDay >= endDay;
  }, []);

  useEffect(() => {
    if (!state.isRunning || state.gameOver) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }

      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      const daysToAdd = (delta / 1000) * BASE_DAYS_PER_SECOND * state.speed;

      setState((prev) => {
        const newDay = prev.currentDay + daysToAdd;

        if (checkGameOver(newDay)) {
          return {
            ...prev,
            currentDay: dateToDays(GAME_END_DATE),
            isRunning: false,
            gameOver: true,
          };
        }

        return processGameDay(newDay, { ...prev, currentDay: newDay });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isRunning, state.gameOver, state.speed, processGameDay, checkGameOver]);

  const startGame = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  const pauseGame = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const resumeGame = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const invest = useCallback(
    (startupId: string, amount: number) => {
      // Check if user has enough spins
      if (getSpinCount() < amount) return;

      setState((prev) => {
        const pendingRound = prev.pendingRounds.find((pr) => pr.startupId === startupId);
        if (!pendingRound) return prev;

        // Check how much has already been invested in this round
        const existingInvestment = prev.investments.find((inv) => inv.startupId === startupId);
        const alreadyInvested = existingInvestment?.amountInvested ?? 0;
        const maxAllowed = pendingRound.event.raised - alreadyInvested;

        if (maxAllowed <= 0) return prev;

        // Cap the investment amount
        const actualAmount = Math.min(amount, maxAllowed);
        if (actualAmount <= 0) return prev;

        // Deduct spins
        onInvest(actualAmount);

        const ownershipPercent = (actualAmount / pendingRound.event.valuation) * 100;

        let newInvestments: Investment[];
        if (existingInvestment) {
          newInvestments = prev.investments.map((inv) => {
            if (inv.startupId === startupId) {
              return {
                ...inv,
                amountInvested: inv.amountInvested + actualAmount,
                sharesOwned: inv.sharesOwned + ownershipPercent,
              };
            }
            return inv;
          });
        } else {
          const newInvestment: Investment = {
            startupId,
            round: pendingRound.event.round,
            amountInvested: actualAmount,
            sharesOwned: ownershipPercent,
            investedAt: prev.currentDay,
            valuationAtInvestment: pendingRound.event.valuation,
          };
          newInvestments = [...prev.investments, newInvestment];
        }

        // Remove from pending if round is fully invested
        const newTotalInvested = alreadyInvested + actualAmount;
        const roundFullyInvested = newTotalInvested >= pendingRound.event.raised;

        return {
          ...prev,
          investments: newInvestments,
          totalInvested: prev.totalInvested + actualAmount,
          pendingRounds: roundFullyInvested
            ? prev.pendingRounds.filter((pr) => pr.startupId !== startupId)
            : prev.pendingRounds,
        };
      });
    },
    [getSpinCount, onInvest]
  );

  const passOnRound = useCallback((startupId: string) => {
    setState((prev) => ({
      ...prev,
      pendingRounds: prev.pendingRounds.filter((pr) => pr.startupId !== startupId),
    }));
  }, []);

  const resetGame = useCallback(() => {
    processedEvents.current.clear();
    setState({
      currentDay: 0,
      isRunning: false,
      speed: 1,
      investments: [],
      pendingRounds: [],
      gameOver: false,
      totalReturned: 0,
      totalInvested: 0,
      exitedStartups: new Map(),
    });
  }, []);

  const currentDate = daysToDate(state.currentDay);

  return {
    state,
    currentDate,
    startGame,
    pauseGame,
    resumeGame,
    setSpeed,
    invest,
    passOnRound,
    getStartupById,
    getStartupValuation,
    resetGame,
  };
};
