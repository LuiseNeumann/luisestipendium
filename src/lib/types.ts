export type CoverageMode = 'live' | 'highlights';

export interface Game {
  id: number;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
  tournament: string;
}

export interface PackagePrice {
  billingPeriod: 'monthly' | 'annual';
  commitmentMonths: 1 | 12;
  monthlyPriceCents: number;
}

export interface StreamingPackage {
  id: number;
  name: string;
  prices: PackagePrice[];
}

export interface GameOffer {
  gameId: number;
  packageId: number;
  live: boolean;
  highlights: boolean;
}

export interface PackageSelection {
  packageId: number;
  name: string;
  costCents: number;
  billingPeriod: 'monthly' | 'annual';
  bookingCount: number;
  bookedMonths: string[];
  coveredGameIds: number[];
}

export interface OptimizationOption {
  kind: 'annual' | 'staggered';
  totalCostCents: number;
  packages: PackageSelection[];
  coveredGameCount: number;
  optimal: boolean;
}

export interface OptimizationResult {
  teams: string[];
  coverageMode: CoverageMode;
  games: Game[];
  unavailableGameIds: number[];
  annual: OptimizationOption;
  staggered: OptimizationOption;
  recommended: 'annual' | 'staggered';
  naiveCostCents: number;
  savingsCents: number;
  savingsPercent: number;
  savingsScore: number;
  durationMs: number;
}
