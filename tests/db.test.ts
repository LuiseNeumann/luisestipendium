import { describe, expect, it } from 'vitest';
import { getGamesForTeams, getOffers, getTournamentRanges, listTeams, listTournaments } from '../src/lib/server/db';

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

  it('filtert Spiele zusätzlich nach Turnier und Zeitraum', () => {
    const games = getGamesForTeams(
      ['Deutschland'],
      '2024-06-01',
      '2024-07-31',
      'Europameisterschaft 2024'
    );

    expect(listTournaments()).toContain('Europameisterschaft 2024');
    expect(games.length).toBeGreaterThan(0);
    expect(games.every((game) => game.tournament === 'Europameisterschaft 2024')).toBe(true);
  });

  it('liefert für jedes Turnier den tatsächlichen Spielzeitraum', () => {
    const tournament = getTournamentRanges().find((item) => item.name === 'Europameisterschaft 2024');

    expect(tournament).toEqual({
      name: 'Europameisterschaft 2024',
      start: '2024-06-14',
      end: '2024-07-14'
    });
  });
});
