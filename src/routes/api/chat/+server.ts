import { error, json } from '@sveltejs/kit';
import { answerQuestion } from '$lib/server/chat';
import { getDataBounds, packagesExist, teamsExist, tournamentExists } from '$lib/server/db';

export async function POST({ request }) {
  const body = (await request.json()) as {
    message?: unknown;
    teams?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    existingPackageIds?: unknown;
    tournament?: unknown;
  };
  if (typeof body.message !== 'string' || body.message.trim().length === 0 || body.message.length > 1_000) {
    error(400, 'Die Nachricht muss zwischen 1 und 1.000 Zeichen lang sein.');
  }
  if (!Array.isArray(body.teams) || body.teams.some((team) => typeof team !== 'string')) {
    error(400, 'Eine gültige Teamauswahl ist erforderlich.');
  }
  const teams = [...new Set(body.teams.map((team) => team.trim()).filter(Boolean))];
  if (teams.length === 0 || teams.length > 8) error(400, 'Bitte eine bis acht Mannschaften auswählen.');
  if (!teamsExist(teams)) error(400, 'Mindestens eine Mannschaft ist im Datensatz nicht vorhanden.');
  const bounds = getDataBounds();
  const startDate = typeof body.startDate === 'string' ? body.startDate : bounds.start;
  const endDate = typeof body.endDate === 'string' ? body.endDate : bounds.end;
  if (startDate > endDate) error(400, 'Bitte einen gültigen Datumsbereich auswählen.');
  const rawExistingPackageIds = body.existingPackageIds ?? [];
  if (!Array.isArray(rawExistingPackageIds) || rawExistingPackageIds.some((id) => !Number.isInteger(id))) {
    error(400, 'Ungültige vorhandene Pakete.');
  }
  const existingPackageIds = [...new Set(rawExistingPackageIds as number[])];
  if (!packagesExist(existingPackageIds)) error(400, 'Mindestens ein vorhandenes Paket ist unbekannt.');
  const tournament = typeof body.tournament === 'string' && body.tournament.trim() ? body.tournament.trim() : undefined;
  if (tournament && !tournamentExists(tournament)) error(400, 'Das ausgewählte Turnier ist unbekannt.');
  return json(await answerQuestion(body.message.trim(), teams, { startDate, endDate, existingPackageIds, tournament }));
}
