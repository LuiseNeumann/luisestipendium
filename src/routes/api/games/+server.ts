import { error, json } from '@sveltejs/kit';
import { getGamesForTeams, getOffers, getPackages, teamsExist } from '$lib/server/db';

export function GET({ url }) {
  const teams = url.searchParams.getAll('team').map((team) => team.trim()).filter(Boolean);
  if (teams.length === 0) error(400, 'Mindestens eine Mannschaft ist erforderlich.');
  if (teams.length > 8) error(400, 'Maximal acht Mannschaften sind erlaubt.');
  if (!teamsExist(teams)) error(400, 'Mindestens eine Mannschaft ist im Datensatz nicht vorhanden.');

  const startDate = url.searchParams.get('start') ?? undefined;
  const endDate = url.searchParams.get('end') ?? undefined;
  const tournaments = url.searchParams.getAll('tournament').map((tournament) => tournament.trim()).filter(Boolean);

  const games = getGamesForTeams([...new Set(teams)], startDate, endDate, tournaments);
  const offers = getOffers(games.map((game) => game.id));
  const packages = getPackages();
  return json({ games, offers, packages });
}
