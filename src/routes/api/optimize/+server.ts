import { error, json } from '@sveltejs/kit';
import { optimizeForTeams } from '$lib/server/optimizer';
import { teamsExist } from '$lib/server/db';
import type { CoverageMode } from '$lib/types';

export async function POST({ request }) {
  const body = (await request.json()) as { teams?: unknown; coverageMode?: unknown };
  if (!Array.isArray(body.teams) || body.teams.some((team) => typeof team !== 'string')) {
    error(400, '`teams` muss eine Liste von Mannschaftsnamen sein.');
  }
  const teams = [...new Set(body.teams.map((team) => team.trim()).filter(Boolean))];
  if (teams.length === 0 || teams.length > 8) error(400, 'Bitte eine bis acht Mannschaften auswählen.');
  if (!teamsExist(teams)) error(400, 'Mindestens eine Mannschaft ist im Datensatz nicht vorhanden.');
  const coverageMode: CoverageMode = body.coverageMode === 'highlights' ? 'highlights' : 'live';

  return json(await optimizeForTeams(teams, coverageMode));
}
