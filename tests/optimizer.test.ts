import { describe, expect, it } from 'vitest';
import { optimizeForTeams, solveCover, type CoverCandidate } from '../src/lib/server/optimizer';

function candidate(id: string, costCents: number, gameIds: number[]): CoverCandidate {
  return {
    id,
    packageId: Number(id.replace(/\D/g, '')) || 1,
    name: id,
    costCents,
    billingPeriod: 'annual',
    bookedMonths: [],
    gameIds
  };
}

describe('solveCover', () => {
  it('findet die günstigste vollständige Paketkombination', async () => {
    const result = await solveCover(
      [1, 2, 3],
      [candidate('p1', 500, [1, 2]), candidate('p2', 400, [2, 3]), candidate('p3', 1_000, [1, 2, 3])]
    );

    expect(result.selected.map((item) => item.id).sort()).toEqual(['p1', 'p2']);
    expect(result.totalCostCents).toBe(900);
    expect(result.optimal).toBe(true);
  });

  it('bevorzugt kostenlose Abdeckung', async () => {
    const result = await solveCover(
      [1, 2],
      [candidate('free', 0, [1]), candidate('paid', 300, [2]), candidate('all', 500, [1, 2])]
    );

    expect(result.totalCostCents).toBe(300);
  });

  it('liefert für eine leere Spielmenge eine leere optimale Lösung', async () => {
    await expect(solveCover([], [])).resolves.toEqual({ selected: [], totalCostCents: 0, optimal: true });
  });

  it('berechnet bei einem Zeitraum über zwölf Monate mehrere Jahresbindungen', async () => {
    const result = await optimizeForTeams(['Bayern München'], 'live');
    const megaSport = result.annual.packages.find((item) => item.name === 'MagentaTV - MegaSport');

    expect(megaSport?.bookingCount).toBe(2);
    expect(megaSport?.costCents).toBe(144_000);
    expect(result.staggered.totalCostCents).toBeLessThan(result.annual.totalCostCents);
  });
});
