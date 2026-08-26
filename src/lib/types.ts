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
  monthlyRateCents: number;
  billingPeriod: 'monthly' | 'annual' | 'existing';
  alreadyOwned: boolean;
  bookingCount: number;
  bookedMonths: string[];
  coveredGameIds: number[];
}

export interface OptimizationOption {
  kind: 'annual' | 'staggered' | 'alternative';
  totalCostCents: number;
  packages: PackageSelection[];
  coveredGameCount: number;
  optimal: boolean;
}

export interface FreeTvCoverage {
  packageId: number;
  name: string;
  coveredGameIds: number[];
}

export interface OptimizationResult {
  teams: string[];
  dateRange: { start: string; end: string };
  tournament: string | null;
  existingPackageIds: number[];
  games: Game[];
  unavailableGameIds: number[];
  annual: OptimizationOption;
  staggered: OptimizationOption;
  recommended: 'annual' | 'staggered';
  alternatives: OptimizationOption[];
  freeTv: FreeTvCoverage[];
  referenceCostCents: number;
  savingsCents: number;
  savingsPercent: number;
  durationMs: number;
}
