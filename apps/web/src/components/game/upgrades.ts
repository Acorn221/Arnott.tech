import {
  Briefcase,
  Cog,
  Dices,
  type LucideIcon,
  Rainbow,
  RotateCw,
  Share2,
  Sparkles,
  TrendingUp,
  Tv,
} from "lucide-react";

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  costs: number[]; // Cost for each level (length = max level)
  effect: (level: number) => number; // Returns multiplier or value based on level
}

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: "bearingUpgrade",
    name: "Bearing Upgrade",
    description: "Increases spin speed",
    icon: Cog,
    costs: [10, 25, 50, 100, 200],
    effect: (level) => 1 + level * 0.2, // 1.0, 1.2, 1.4, 1.6, 1.8, 2.0
  },
  {
    id: "rgbMode",
    name: "RGB Mode",
    description: "Rainbow spinner + spin multiplier",
    icon: Rainbow,
    costs: [50, 150, 300],
    effect: (level) => (level === 0 ? 1 : 1 + level), // 1x, 2x, 3x, 4x multiplier
  },
  {
    id: "gamblingMode",
    name: "Tech Stack Machine",
    description: "Spin for tech stack combos!",
    icon: Dices,
    costs: [500, 5000, 50000, 2000000],
    effect: (level) => [0, 1, 10, 50, 100][level] ?? 0, // 0 = locked, then 1x, 10x, 50x, 100x
  },
  {
    id: "stimulationMode",
    name: "Stimulation Mode",
    description: "Unlock the /stimulation-spinner page",
    icon: Sparkles,
    costs: [10000],
    effect: (level) => (level > 0 ? 1 : 0),
  },
  {
    id: "autoSpin",
    name: "Auto Spin",
    description: "Automatically spins the fidget spinner",
    icon: RotateCw,
    costs: [50000, 100000, 200000, 400000, 750000, 1500000, 3000000, 5000000],
    effect: (level) => level, // 0 = off, 1-8 = speed levels
  },
  {
    id: "theoMode",
    name: "Theo complaining about nextjs",
    description: "Multiplier while Theo rants",
    icon: Tv,
    costs: [1000000, 5000000, 25000000],
    effect: (level) => [1, 2, 3, 4][level] ?? 1, // 1x, 2x, 3x, 4x multiplier
  },
  {
    id: "ftxMode",
    name: "Invest in FTX",
    description: "Sell before the crash!",
    icon: TrendingUp,
    costs: [3000000],
    effect: (level) => (level > 0 ? 1 : 0),
  },
  {
    id: "vcMode",
    name: "VC Mode",
    description: "Become a venture capitalist!",
    icon: Briefcase,
    costs: [5000000],
    effect: (level) => (level > 0 ? 1 : 0),
  },
  {
    id: "continueOnDesktop",
    name: "Continue on Desktop",
    description: "Share a link to continue your progress",
    icon: Share2,
    costs: [], // No cost - triggers share action
    effect: () => 0, // No effect
  },
];

export type UpgradeId = (typeof UPGRADES)[number]["id"];

export const getUpgradeById = (id: string): UpgradeDefinition | undefined =>
  UPGRADES.find((u) => u.id === id);

export const getMaxLevel = (upgrade: UpgradeDefinition): number =>
  upgrade.costs.length;

export const getUpgradeCost = (
  upgrade: UpgradeDefinition,
  currentLevel: number,
): number => {
  if (currentLevel >= upgrade.costs.length) return Infinity;
  return upgrade.costs[currentLevel];
};
