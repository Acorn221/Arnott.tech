export type StartupOutcome = 'ipo' | 'acquired' | 'bankrupt' | 'private';

export type StartupSector =
  | 'Healthcare'
  | 'Real Estate'
  | 'Transportation'
  | 'Travel'
  | 'Crypto'
  | 'Consumer Hardware'
  | 'Entertainment'
  | 'Social Media'
  | 'Enterprise Software'
  | 'Fintech'
  | 'Delivery'
  | 'Aerospace'
  | 'Cloud Storage'
  | 'Energy'
  | 'E-commerce'
  | 'Services'
  | 'Construction';

export interface FundingEvent {
  type: 'funding';
  date: string; // ISO date string
  round: string;
  raised: number; // in USD
  valuation: number; // post-money valuation in USD
}

export interface MilestoneEvent {
  type: 'milestone';
  date: string;
  description: string;
}

export interface PivotEvent {
  type: 'pivot';
  date: string;
  description: string;
}

export interface ExitEvent {
  type: 'exit';
  date: string;
  outcome: StartupOutcome;
  finalValuation: number;
  acquirer?: string; // For acquisitions
}

export type StartupEvent = FundingEvent | MilestoneEvent | PivotEvent | ExitEvent;

export interface Startup {
  id: string;
  name: string;
  description: string;
  foundedDate: string; // ISO date string
  sector: StartupSector;
  outcome: StartupOutcome;
  events: StartupEvent[];
}

export interface StartupsData {
  startups: Startup[];
}

export interface Investment {
  startupId: string;
  round: string;
  amountInvested: number;
  sharesOwned: number; // Percentage ownership
  investedAt: number; // Day number when invested
  valuationAtInvestment: number;
}

export interface PendingRound {
  startupId: string;
  event: FundingEvent;
  createdAtDay: number; // Day when this opportunity appeared
  expiresAtDay: number; // Day when this opportunity closes
}

export function isFundingEvent(event: StartupEvent): event is FundingEvent {
  return event.type === 'funding';
}

export function isExitEvent(event: StartupEvent): event is ExitEvent {
  return event.type === 'exit';
}

export function formatValuation(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
}

// Get current value of an investment based on latest valuation
export function getInvestmentValue(
  investment: Investment,
  currentValuation: number
): number {
  return (investment.sharesOwned / 100) * currentValuation;
}
