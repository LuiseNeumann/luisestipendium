import { error, json } from '@sveltejs/kit';
import { optimizeForTeams } from '$lib/server/optimizer';
import { getDataBounds, packagesExist, teamsExist, tournamentsExist } from '$lib/server/db';

export async function POST({ request }) {
  const body = (await request.json()) as {
    teams?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    existingPackageIds?: unknown;
    tournaments?: unknown;
  };
  if (!Array.isArray(body.teams) || body.teams.some((team) => typeof team !== 'string')) {
    error(400, '`teams` muss eine Liste von Mannschaftsnamen sein.');
  }
  const teams = [...new Set(body.teams.map((team) => team.trim()).filter(Boolean))];
  if (teams.length === 0 || teams.length > 8) error(400, 'Bitte eine bis acht Mannschaften auswählen.');
  if (!teamsExist(teams)) error(400, 'Mindestens eine Mannschaft ist im Datensatz nicht vorhanden.');
  const bounds = getDataBounds();
  const startDate = typeof body.startDate === 'string' ? body.startDate : bounds.start;
  const endDate = typeof body.endDate === 'string' ? body.endDate : bounds.end;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    error(400, 'Bitte einen gültigen Datumsbereich auswählen.');
  }
  const rawExistingPackageIds = body.existingPackageIds ?? [];
  if (!Array.isArray(rawExistingPackageIds) || rawExistingPackageIds.some((id) => !Number.isInteger(id))) {
    error(400, '`existingPackageIds` muss eine Liste gültiger Paket-IDs sein.');
  }
  const existingPackageIds = [...new Set(rawExistingPackageIds as number[])];
  if (!packagesExist(existingPackageIds)) error(400, 'Mindestens ein vorhandenes Paket ist unbekannt.');
  const rawTournaments = body.tournaments ?? [];
  if (!Array.isArray(rawTournaments) || rawTournaments.some((tournament) => typeof tournament !== 'string')) {
    error(400, '`tournaments` muss eine Liste gültiger Turniernamen sein.');
  }
  const tournaments = [...new Set(rawTournaments.map((tournament) => tournament.trim()).filter(Boolean))];
  if (!tournamentsExist(tournaments)) error(400, 'Mindestens ein ausgewähltes Turnier ist unbekannt.');

  return json(await optimizeForTeams(teams, { startDate, endDate, existingPackageIds, tournaments }));
}
