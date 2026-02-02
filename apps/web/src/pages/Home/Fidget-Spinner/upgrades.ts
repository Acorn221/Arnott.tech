import { Cog, Rainbow, type LucideIcon } from "lucide-react";

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
