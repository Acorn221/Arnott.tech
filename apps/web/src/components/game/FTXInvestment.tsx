import { type FC, useState, useEffect, useRef, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addSpins, spendSpins, selectSpinCount } from "@/store/slices/gameSlice";

const INVESTMENT_COST = 2_000_000;
const DAYS_PER_SECOND = 18; // ~1050 days over 60 seconds = 1 min total

// Simplified FTT price history (date, price in USD)
// Starts Jan 2020, peaks Sept 2021, crashes Nov 2022
const FTT_PRICE_DATA: Array<{ date: Date; price: number }> = [
  { date: new Date("2020-01-01"), price: 2.1 },
  { date: new Date("2020-03-01"), price: 1.8 },
  { date: new Date("2020-06-01"), price: 3.2 },
  { date: new Date("2020-09-01"), price: 4.5 },
  { date: new Date("2020-12-01"), price: 5.8 },
  { date: new Date("2021-01-01"), price: 8.5 },
  { date: new Date("2021-03-01"), price: 42.0 },
  { date: new Date("2021-05-01"), price: 52.0 },
  { date: new Date("2021-07-01"), price: 32.0 },
  { date: new Date("2021-09-01"), price: 78.0 }, // Peak
  { date: new Date("2021-11-01"), price: 62.0 },
  { date: new Date("2022-01-01"), price: 45.0 },
  { date: new Date("2022-03-01"), price: 42.0 },
  { date: new Date("2022-05-01"), price: 30.0 },
  { date: new Date("2022-07-01"), price: 27.0 },
  { date: new Date("2022-09-01"), price: 25.0 },
  { date: new Date("2022-11-01"), price: 24.0 },
  { date: new Date("2022-11-06"), price: 22.0 }, // Start of crash
  { date: new Date("2022-11-08"), price: 15.0 },
  { date: new Date("2022-11-09"), price: 5.0 },
  { date: new Date("2022-11-10"), price: 2.5 },
  { date: new Date("2022-11-11"), price: 1.0 },
  { date: new Date("2022-11-12"), price: 0.1 }, // Crashed
];

const START_DATE = FTT_PRICE_DATA[0].date;
const END_DATE = FTT_PRICE_DATA[FTT_PRICE_DATA.length - 1].date;
const INITIAL_PRICE = FTT_PRICE_DATA[0].price;

// Interpolate price at any given date
const getPriceAtDate = (date: Date): number => {
  const time = date.getTime();

  // Find surrounding data points
  for (let i = 0; i < FTT_PRICE_DATA.length - 1; i++) {
    const curr = FTT_PRICE_DATA[i];
    const next = FTT_PRICE_DATA[i + 1];

    if (time >= curr.date.getTime() && time <= next.date.getTime()) {
      const progress =
        (time - curr.date.getTime()) /
        (next.date.getTime() - curr.date.getTime());
      return curr.price + (next.price - curr.price) * progress;
    }
  }

  // Past the end
  return FTT_PRICE_DATA[FTT_PRICE_DATA.length - 1].price;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
};

interface FTXInvestmentProps {
  className?: string;
  onClose?: () => void;
}

const FTXInvestment: FC<FTXInvestmentProps> = ({ className, onClose }) => {
  const dispatch = useAppDispatch();
  const spinCount = useAppSelector(selectSpinCount);

  const [isInvested, setIsInvested] = useState(false);
  const [currentDate, setCurrentDate] = useState(START_DATE);
  const [currentPrice, setCurrentPrice] = useState(INITIAL_PRICE);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<"win" | "loss" | null>(null);
  const [finalValue, setFinalValue] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const canAfford = spinCount >= INVESTMENT_COST;

  // Calculate current value based on price multiplier
  const multiplier = currentPrice / INITIAL_PRICE;
  const currentValue = Math.floor(INVESTMENT_COST * multiplier);

  // Draw the chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    // Clear
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, width, height);

    // Find max price for scaling
    const maxPrice = Math.max(...FTT_PRICE_DATA.map((d) => d.price)) * 1.1;
    const timeRange = END_DATE.getTime() - START_DATE.getTime();

    // Draw grid lines
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + ((height - padding * 2) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Price label
      ctx.fillStyle = "#71717a";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "right";
      const priceLabel = (maxPrice * (1 - i / 4)).toFixed(0);
      ctx.fillText(`$${priceLabel}`, padding - 5, y + 3);
    }

    // Draw price line (historical up to current date)
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();

    let firstPoint = true;
    for (const point of FTT_PRICE_DATA) {
      if (point.date > currentDate) break;

      const x =
        padding +
        ((point.date.getTime() - START_DATE.getTime()) / timeRange) *
          (width - padding * 2);
      const y =
        padding +
        (1 - point.price / maxPrice) * (height - padding * 2);

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Add current interpolated point
    const currentX =
      padding +
      ((currentDate.getTime() - START_DATE.getTime()) / timeRange) *
        (width - padding * 2);
    const currentY =
      padding + (1 - currentPrice / maxPrice) * (height - padding * 2);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    // Draw current point marker
    ctx.fillStyle = currentPrice > INITIAL_PRICE ? "#22c55e" : "#ef4444";
    ctx.beginPath();
    ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw current price label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`$${currentPrice.toFixed(2)}`, currentX + 10, currentY + 4);
  }, [currentDate, currentPrice]);

  // Animation loop
  useEffect(() => {
    if (!isInvested || gameOver) return;

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }

      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Advance time
      const daysToAdd = (delta / 1000) * DAYS_PER_SECOND;
      const msToAdd = daysToAdd * 24 * 60 * 60 * 1000;

      setCurrentDate((prev) => {
        const newDate = new Date(prev.getTime() + msToAdd);

        // Check if we've reached the end (crashed)
        if (newDate >= END_DATE) {
          setGameOver(true);
          setResult("loss");
          setFinalValue(0);
          return END_DATE;
        }

        return newDate;
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
  }, [isInvested, gameOver]);

  // Update price when date changes
  useEffect(() => {
    setCurrentPrice(getPriceAtDate(currentDate));
  }, [currentDate]);

  // Draw chart when state changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  const handleInvest = () => {
    if (!canAfford) return;
    dispatch(spendSpins(INVESTMENT_COST));
    setIsInvested(true);
    setGameOver(false);
    setResult(null);
    setCurrentDate(START_DATE);
    setCurrentPrice(INITIAL_PRICE);
  };

  const handleSell = () => {
    if (!isInvested || gameOver) return;

    // Stop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setGameOver(true);
    setResult("win");
    setFinalValue(currentValue);
    dispatch(addSpins(currentValue));
    setIsInvested(false);
  };

  return (
    <div
      className={`bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700 ${className ?? ""}`}
    >
      <div className="px-3 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
        <span className="text-sm font-medium">FTX Investment Simulator</span>
        <div className="flex items-center gap-2">
          {isInvested && !gameOver && (
            <span className="text-xs text-zinc-400">{formatDate(currentDate)}</span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="p-3">
        <canvas
          ref={canvasRef}
          width={350}
          height={180}
          className="w-full rounded bg-zinc-950"
        />

        {/* Status display */}
        <div className="mt-3 flex justify-between items-center text-sm">
          <div>
            <span className="text-zinc-400">Investment: </span>
            <span className="font-medium">{formatNumber(INVESTMENT_COST)}</span>
          </div>
          {isInvested && (
            <div>
              <span className="text-zinc-400">Value: </span>
              <span
                className={`font-medium ${currentValue >= INVESTMENT_COST ? "text-green-400" : "text-red-400"}`}
              >
                {formatNumber(currentValue)} ({multiplier.toFixed(2)}x)
              </span>
            </div>
          )}
        </div>

        {/* Result message */}
        {gameOver && result === "win" && (
          <div className="mt-3 p-3 bg-green-900/50 border border-green-700 rounded text-center">
            <div className="text-green-400 font-bold text-lg">YOU WON!</div>
            <div className="text-green-400 mt-1">
              Sold for {formatNumber(finalValue)} spins! (+
              {formatNumber(finalValue - INVESTMENT_COST)})
            </div>
          </div>
        )}

        {gameOver && result === "loss" && (
          <div className="mt-3 p-3 bg-red-900/50 border border-red-700 rounded text-center">
            <div className="text-red-400 font-bold text-lg">YOU LOST!</div>
            <div className="text-red-400 mt-1">
              FTX collapsed! You lost {formatNumber(INVESTMENT_COST)} spins!
            </div>
          </div>
        )}

        {/* Action buttons - only show if game not completed */}
        {!gameOver && (
          <div className="mt-3 flex gap-2">
            {!isInvested && (
              <button
                onClick={handleInvest}
                disabled={!canAfford}
                className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
                  canAfford
                    ? "bg-blue-600 hover:bg-blue-500 cursor-pointer"
                    : "bg-zinc-700 opacity-50 cursor-not-allowed"
                }`}
              >
                Invest {formatNumber(INVESTMENT_COST)}
              </button>
            )}

            {isInvested && (
              <button
                onClick={handleSell}
                className="flex-1 py-2 px-4 rounded font-medium bg-green-600 hover:bg-green-500 cursor-pointer"
              >
                SELL NOW ({formatNumber(currentValue)})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FTXInvestment;
