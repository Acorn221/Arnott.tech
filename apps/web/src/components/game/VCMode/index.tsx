import { Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addSpins, selectSpinCount, spendSpins } from '@/store/slices/gameSlice';

import { formatValuation, getInvestmentValue } from './types';
import { useVCGameLoop } from './useVCGameLoop';

interface VCModeProps {
  className?: string;
  onClose?: () => void;
}

const INVEST_STEPS = [100_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

const formatSpins = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
};

export const VCMode = ({ className, onClose }: VCModeProps) => {
  const dispatch = useAppDispatch();
  const spinCount = useAppSelector(selectSpinCount);
  const spinCountRef = useRef(spinCount);
  spinCountRef.current = spinCount;

  const hasStarted = useRef(false);
  const [flashingStartup, setFlashingStartup] = useState<string | null>(null);
  const [investAmount, setInvestAmount] = useState(INVEST_STEPS[INVEST_STEPS.length - 1]);

  const handleSpinsReturned = useCallback(
    (amount: number) => {
      dispatch(addSpins(amount));
    },
    [dispatch]
  );

  const handleInvest = useCallback(
    (amount: number) => {
      dispatch(spendSpins(amount));
    },
    [dispatch]
  );

  const getSpinCount = useCallback(() => spinCountRef.current, []);

  const {
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
  } = useVCGameLoop({
    onSpinsReturned: handleSpinsReturned,
    onInvest: handleInvest,
    getSpinCount,
  });

  // Calculate portfolio value
  const portfolioValue = state.investments.reduce((total, inv) => {
    const currentVal = getStartupValuation(inv.startupId);
    return total + getInvestmentValue(inv, currentVal);
  }, 0);

  const totalValue = portfolioValue + state.totalReturned;
  const gainLossPercent =
    state.totalInvested > 0 ? ((totalValue - state.totalInvested) / state.totalInvested) * 100 : 0;

  // Autostart on mount
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startGame();
    }
  }, [startGame]);

  // Cash out and exit
  const handleExit = useCallback(() => {
    // Add current portfolio value to spins
    if (portfolioValue > 0) {
      dispatch(addSpins(Math.floor(portfolioValue)));
    }
    onClose?.();
  }, [portfolioValue, dispatch, onClose]);

  // Auto-exit when game ends
  useEffect(() => {
    if (state.gameOver) {
      handleExit();
    }
  }, [state.gameOver, handleExit]);

  const doInvest = (startupId: string, amount: number) => {
    invest(startupId, amount);
    // Flash animation
    setFlashingStartup(startupId);
    setTimeout(() => setFlashingStartup(null), 300);
  };


  // Active game
  return (
    <div className={`bg-zinc-900 rounded-lg border border-zinc-700 select-none flex flex-col ${className ?? ''}`}>
      {/* Header */}
      <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
        <span className="text-sm font-medium">{formatDate(currentDate)}</span>
        <div className="flex items-center gap-1">
          {[0.25, 0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 text-xs rounded ${
                state.speed === s ? 'bg-green-600' : 'bg-zinc-700'
              }`}
            >
              {s}x
            </button>
          ))}
          <button
            onClick={state.isRunning ? pauseGame : resumeGame}
            className="w-6 h-6 flex items-center justify-center rounded bg-zinc-700 ml-1"
          >
            {state.isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Portfolio */}
      <div className="px-3 py-2 border-b border-zinc-700/50 flex justify-between items-center">
        <div>
          <p className="text-lg font-bold">{formatSpins(Math.floor(totalValue))}</p>
          <p className="text-xs text-zinc-500">Invested: {formatSpins(state.totalInvested)}</p>
        </div>
        <p className={`font-medium ${gainLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(0)}%
        </p>
      </div>

      {/* Pending rounds - grows to fill space */}
      <div className="px-3 py-2 border-b border-zinc-700/50 overflow-hidden flex-1 flex flex-col">
        <p className="text-xs text-zinc-400 mb-2">Invest Now</p>
        <div className="space-y-2 flex-1 overflow-y-auto overflow-x-hidden">
          {state.pendingRounds.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              Waiting for deals...
            </div>
          )}
          {state.pendingRounds.map((pr) => {
            const startup = getStartupById(pr.startupId);
            if (!startup) return null;

            const totalWindow = pr.expiresAtDay - pr.createdAtDay;
            const daysRemaining = pr.expiresAtDay - state.currentDay;
            const timeRemainingPercent = Math.min(1, Math.max(0, daysRemaining / totalWindow));
            const isExpired = daysRemaining <= 0;
            const isUrgent = timeRemainingPercent < 0.3;

            // Calculate max investable amount
            const existingInvestment = state.investments.find((inv) => inv.startupId === pr.startupId);
            const alreadyInvested = existingInvestment?.amountInvested ?? 0;
            const roundRemaining = pr.event.raised - alreadyInvested;
            const maxInvestable = Math.min(investAmount, roundRemaining, spinCount);
            const canInvest = maxInvestable > 0 && !isExpired;
            const isFlashing = flashingStartup === pr.startupId;

            return (
              <div
                key={`${pr.startupId}-${pr.event.round}`}
                className={`rounded p-2 transition-colors duration-150 ${
                  isFlashing ? 'bg-green-600' : isExpired ? 'bg-zinc-800/50 opacity-50' : 'bg-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="font-medium text-sm">{startup.name}</p>
                    <p className="text-xs text-zinc-500">{pr.event.round} @ {formatValuation(pr.event.valuation)}</p>
                  </div>
                  <div className="flex gap-1">
                    {!isExpired && (
                      <>
                        <button
                          onClick={() => doInvest(pr.startupId, maxInvestable)}
                          disabled={!canInvest}
                          className={`px-3 py-1 text-xs rounded font-medium ${
                            canInvest
                              ? 'bg-green-600 hover:bg-green-500'
                              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          {formatSpins(maxInvestable)}
                        </button>
                        <button
                          onClick={() => passOnRound(pr.startupId)}
                          className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded"
                        >
                          Pass
                        </button>
                      </>
                    )}
                    {isExpired && (
                      <span className="text-xs text-red-400">Expired</span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${isExpired ? 'bg-red-500' : isUrgent ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${timeRemainingPercent * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Investments */}
      {state.investments.length > 0 && (
        <div className="px-3 py-2">
          <p className="text-xs text-zinc-400 mb-1">Holdings</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {state.investments.map((inv) => {
              const startup = getStartupById(inv.startupId);
              const currentVal = getStartupValuation(inv.startupId);
              const currentValue = getInvestmentValue(inv, currentVal);
              const roi = inv.amountInvested > 0
                ? ((currentValue - inv.amountInvested) / inv.amountInvested) * 100
                : 0;

              return (
                <div key={inv.startupId} className="flex justify-between text-xs">
                  <span>{startup?.name}</span>
                  <span className={roi >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invest amount slider */}
      <div className="px-3 py-2 border-t border-zinc-700/50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-400">Invest Amount</span>
          <span className="text-xs font-medium">{formatSpins(investAmount)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={INVEST_STEPS.length - 1}
          value={INVEST_STEPS.indexOf(investAmount)}
          onChange={(e) => setInvestAmount(INVEST_STEPS[parseInt(e.target.value)])}
          className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
        <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
          <span>100K</span>
          <span>5M</span>
        </div>
      </div>

      {/* Exit button */}
      <div className="px-3 py-2 border-t border-zinc-700/50">
        <button
          onClick={handleExit}
          className="w-full py-1.5 text-xs bg-red-600 hover:bg-red-500 rounded font-medium"
        >
          Exit {portfolioValue > 0 ? `(+${formatSpins(Math.floor(portfolioValue))})` : ''}
        </button>
      </div>
    </div>
  );
};
