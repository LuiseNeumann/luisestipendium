import { describe, expect, it } from 'vitest';
import { getGamesForTeams, getOffers, listTeams } from '../src/lib/server/db';

describe('CSV-Datenbank', () => {
  it('findet Mannschaften unabhängig von Groß-/Kleinschreibung', () => {
    expect(listTeams('deutsch', 10)).toContain('Deutschland');
  });

  it('liefert Spiele und passende Live-Angebote', () => {
    const games = getGamesForTeams(['Deutschland']);
    const offers = getOffers(games.map((game) => game.id), 'live');

    expect(games.length).toBeGreaterThan(0);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => offer.live)).toBe(true);
  });
});
