export const SPIN_COST = 10;

export const calculateSpinsWon = (score: number): number => {
  if (score < 25) return 0;
  const normalized = score / 100;
  return Math.floor(Math.pow(normalized, 2.5) * 10000);
};
