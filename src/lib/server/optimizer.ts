import GLPK, { type GLPK as GlpkInstance, type LP } from 'glpk.js/node';
import type {
  CoverageMode,
  Game,
  OptimizationOption,
  OptimizationResult,
  PackageSelection,
  StreamingPackage
} from '$lib/types';
import { getGamesForTeams, getOffers, getPackages } from './db';

export interface CoverCandidate {
  id: string;
  packageId: number;
  name: string;
  costCents: number;
  billingPeriod: 'monthly' | 'annual';
  bookedMonths: string[];
  gameIds: number[];
}

export interface CoverSolution {
  selected: CoverCandidate[];
  totalCostCents: number;
  optimal: boolean;
}

let glpkPromise: Promise<GlpkInstance> | undefined;

function getGlpk() {
  glpkPromise ??= GLPK();
  return glpkPromise;
}

function greedyCover(gameIds: number[], candidates: CoverCandidate[]): CoverSolution {
  const uncovered = new Set(gameIds);
  const selected: CoverCandidate[] = [];

  while (uncovered.size > 0) {
    let best: CoverCandidate | undefined;
    let bestNewGames: number[] = [];
    let bestScore = -1;

    for (const candidate of candidates) {
      const newGames = candidate.gameIds.filter((id) => uncovered.has(id));
      if (newGames.length === 0) continue;
      const score = candidate.costCents === 0 ? Number.POSITIVE_INFINITY : newGames.length / candidate.costCents;
      if (score > bestScore || (score === bestScore && newGames.length > bestNewGames.length)) {
        best = candidate;
        bestNewGames = newGames;
        bestScore = score;
      }
    }

    if (!best) break;
    selected.push(best);
    for (const id of bestNewGames) uncovered.delete(id);
  }

  return {
    selected,
    totalCostCents: selected.reduce((sum, item) => sum + item.costCents, 0),
    optimal: false
  };
}

export async function solveCover(gameIds: number[], candidates: CoverCandidate[]): Promise<CoverSolution> {
  if (gameIds.length === 0) return { selected: [], totalCostCents: 0, optimal: true };

  const usefulCandidates = candidates.filter((candidate) => candidate.gameIds.length > 0);
  if (usefulCandidates.length > 1_000 || gameIds.length > 1_500) {
    return greedyCover(gameIds, usefulCandidates);
  }

  const glpk = await getGlpk();
  const variableNames = usefulCandidates.map((_, index) => `x${index}`);
  const lp: LP = {
    name: 'streaming_set_cover',
    objective: {
      direction: glpk.GLP_MIN,
      name: 'cost',
      vars: usefulCandidates.map((candidate, index) => ({ name: variableNames[index], coef: candidate.costCents }))
    },
    subjectTo: gameIds.map((gameId, index) => ({
      name: `game_${index}`,
      vars: usefulCandidates.flatMap((candidate, candidateIndex) =>
        candidate.gameIds.includes(gameId) ? [{ name: variableNames[candidateIndex], coef: 1 }] : []
      ),
      bnds: { type: glpk.GLP_LO, lb: 1, ub: 0 }
    })),
    binaries: variableNames
  };

  const result = glpk.solve(lp, { msglev: glpk.GLP_MSG_OFF, presol: true, tmlim: 2, mipgap: 0 });
  const hasSolution = result.result.status === glpk.GLP_OPT || result.result.status === glpk.GLP_FEAS;
  if (!hasSolution) return greedyCover(gameIds, usefulCandidates);

  const selected = usefulCandidates.filter((_, index) => result.result.vars[variableNames[index]] > 0.5);
  return {
    selected,
    totalCostCents: selected.reduce((sum, item) => sum + item.costCents, 0),
    optimal: result.result.status === glpk.GLP_OPT
  };
}

function annualCost(streamingPackage: StreamingPackage): number | undefined {
  const annual = streamingPackage.prices.find((price) => price.billingPeriod === 'annual');
  const monthly = streamingPackage.prices.find((price) => price.billingPeriod === 'monthly');
  const price = annual ?? monthly;
  return price ? price.monthlyPriceCents * 12 : undefined;
}

function monthIndex(value: string) {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  return year * 12 + month - 1;
}

function monthName(index: number) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function monthRange(start: number, length = 12) {
  return Array.from({ length }, (_, offset) => monthName(start + offset));
}

function aggregateSelections(selected: CoverCandidate[]): PackageSelection[] {
  const aggregated = new Map<string, PackageSelection>();
  for (const candidate of selected) {
    const key = `${candidate.packageId}-${candidate.billingPeriod}`;
    const existing = aggregated.get(key) ?? {
      packageId: candidate.packageId,
      name: candidate.name,
      costCents: 0,
      billingPeriod: candidate.billingPeriod,
      bookingCount: 0,
      bookedMonths: [],
      coveredGameIds: []
    };
    existing.costCents += candidate.costCents;
    existing.bookingCount += 1;
    existing.bookedMonths.push(...candidate.bookedMonths);
    existing.coveredGameIds.push(...candidate.gameIds);
    existing.bookedMonths = [...new Set(existing.bookedMonths)].sort();
    existing.coveredGameIds = [...new Set(existing.coveredGameIds)].sort((a, b) => a - b);
    aggregated.set(key, existing);
  }
  return [...aggregated.values()].sort((a, b) => b.coveredGameIds.length - a.coveredGameIds.length);
}

function asOption(kind: 'annual' | 'staggered', solution: CoverSolution, gameCount: number): OptimizationOption {
  return {
    kind,
    totalCostCents: solution.totalCostCents,
    packages: aggregateSelections(solution.selected),
    coveredGameCount: gameCount,
    optimal: solution.optimal
  };
}

export async function optimizeForTeams(teams: string[], coverageMode: CoverageMode): Promise<OptimizationResult> {
  const startedAt = performance.now();
  const games = getGamesForTeams(teams);
  const packages = getPackages();
  const packageById = new Map(packages.map((item) => [item.id, item]));
  const offers = getOffers(
    games.map((game) => game.id),
    coverageMode
  );
  const gamesByPackage = new Map<number, number[]>();
  for (const offer of offers) {
    const ids = gamesByPackage.get(offer.packageId) ?? [];
    ids.push(offer.gameId);
    gamesByPackage.set(offer.packageId, ids);
  }

  const coverableIds = new Set(offers.map((offer) => offer.gameId));
  const coverableGames = games.filter((game) => coverableIds.has(game.id));
  const unavailableGameIds = games.filter((game) => !coverableIds.has(game.id)).map((game) => game.id);

  const gameById = new Map(games.map((game) => [game.id, game]));
  const allGameMonths = coverableGames.map((game) => monthIndex(game.startsAt));
  const firstMonth = allGameMonths.length > 0 ? Math.min(...allGameMonths) : 0;
  const lastMonth = allGameMonths.length > 0 ? Math.max(...allGameMonths) : 0;
  const annualCandidates: CoverCandidate[] = [];
  for (const [packageId, gameIds] of gamesByPackage) {
    const item = packageById.get(packageId);
    if (!item) continue;
    const costCents = annualCost(item);
    if (costCents === undefined) continue;
    for (let blockStart = firstMonth; blockStart <= lastMonth; blockStart += 12) {
      const blockGameIds = [...new Set(gameIds)].filter((gameId) => {
        const month = monthIndex(gameById.get(gameId)!.startsAt);
        return month >= blockStart && month < blockStart + 12;
      });
      if (blockGameIds.length === 0) continue;
      annualCandidates.push({
        id: `annual-${packageId}-${blockStart}`,
        packageId,
        name: item.name,
        costCents,
        billingPeriod: 'annual',
        bookedMonths: monthRange(blockStart),
        gameIds: blockGameIds
      });
    }
  }

  const staggeredCandidates: CoverCandidate[] = [];
  for (const [packageId, offeredGameIds] of gamesByPackage) {
    const item = packageById.get(packageId);
    if (!item) continue;
    const uniqueGameIds = [...new Set(offeredGameIds)];
    const annualPrice = item.prices.find((price) => price.billingPeriod === 'annual');
    const monthlyPrice = item.prices.find((price) => price.billingPeriod === 'monthly');

    if (annualPrice) {
      const possibleStarts = [...new Set(uniqueGameIds.map((gameId) => monthIndex(gameById.get(gameId)!.startsAt)))];
      for (const start of possibleStarts) {
        const windowGameIds = uniqueGameIds.filter((gameId) => {
          const month = monthIndex(gameById.get(gameId)!.startsAt);
          return month >= start && month < start + 12;
        });
        staggeredCandidates.push({
          id: `annual-window-${item.id}-${start}`,
          packageId: item.id,
          name: item.name,
          costCents: annualPrice.monthlyPriceCents * 12,
          billingPeriod: 'annual',
          bookedMonths: monthRange(start),
          gameIds: windowGameIds
        });
      }
    }
    if (monthlyPrice) {
      const gamesPerMonth = new Map<string, number[]>();
      for (const gameId of uniqueGameIds) {
        const month = gameById.get(gameId)!.startsAt.slice(0, 7);
        const monthGames = gamesPerMonth.get(month) ?? [];
        monthGames.push(gameId);
        gamesPerMonth.set(month, monthGames);
      }
      for (const [month, gameIds] of gamesPerMonth) {
        staggeredCandidates.push({
          id: `monthly-${item.id}-${month}`,
          packageId: item.id,
          name: item.name,
          costCents: monthlyPrice.monthlyPriceCents,
          billingPeriod: 'monthly',
          bookedMonths: [month],
          gameIds
        });
      }
    }
  }

  const targetGameIds = coverableGames.map((game) => game.id);
  const [annualSolution, staggeredSolution] = await Promise.all([
    solveCover(targetGameIds, annualCandidates),
    solveCover(targetGameIds, staggeredCandidates)
  ]);
  const annual = asOption('annual', annualSolution, targetGameIds.length);
  const staggered = asOption('staggered', staggeredSolution, targetGameIds.length);
  const recommended = staggered.totalCostCents < annual.totalCostCents ? 'staggered' : 'annual';
  const recommendedCost = recommended === 'staggered' ? staggered.totalCostCents : annual.totalCostCents;
  const naiveCostCents = annualCandidates.reduce((sum, candidate) => sum + candidate.costCents, 0);
  const savingsCents = Math.max(0, naiveCostCents - recommendedCost);

  return {
    teams,
    coverageMode,
    games,
    unavailableGameIds,
    annual,
    staggered,
    recommended,
    naiveCostCents,
    savingsCents,
    savingsPercent: naiveCostCents === 0 ? 0 : Math.round((savingsCents / naiveCostCents) * 100),
    savingsScore: annual.optimal && staggered.optimal ? 100 : 95,
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10
  };
}
