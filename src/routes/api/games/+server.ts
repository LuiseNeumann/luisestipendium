import { error, json } from '@sveltejs/kit';
import { getGamesForTeams, getOffers, getPackages, teamsExist } from '$lib/server/db';

export function GET({ url }) {
  const teams = url.searchParams.getAll('team').map((team) => team.trim()).filter(Boolean);
  if (teams.length === 0) error(400, 'Mindestens eine Mannschaft ist erforderlich.');
  if (teams.length > 8) error(400, 'Maximal acht Mannschaften sind erlaubt.');
  if (!teamsExist(teams)) error(400, 'Mindestens eine Mannschaft ist im Datensatz nicht vorhanden.');

  const games = getGamesForTeams([...new Set(teams)]);
  const offers = getOffers(games.map((game) => game.id));
  const packages = getPackages();
  return json({ games, offers, packages });
}
