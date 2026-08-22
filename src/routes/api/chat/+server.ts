import { error, json } from '@sveltejs/kit';
import { answerQuestion } from '$lib/server/chat';
import { teamsExist } from '$lib/server/db';
import type { CoverageMode } from '$lib/types';

export async function POST({ request }) {
  const body = (await request.json()) as { message?: unknown; teams?: unknown; coverageMode?: unknown };
  if (typeof body.message !== 'string' || body.message.trim().length === 0 || body.message.length > 1_000) {
    error(400, 'Die Nachricht muss zwischen 1 und 1.000 Zeichen lang sein.');
  }
  if (!Array.isArray(body.teams) || body.teams.some((team) => typeof team !== 'string')) {
    error(400, 'Eine gültige Teamauswahl ist erforderlich.');
  }
  const teams = [...new Set(body.teams.map((team) => team.trim()).filter(Boolean))];
  if (teams.length === 0 || teams.length > 8) error(400, 'Bitte eine bis acht Mannschaften auswählen.');
  if (!teamsExist(teams)) error(400, 'Mindestens eine Mannschaft ist im Datensatz nicht vorhanden.');
  const coverageMode: CoverageMode = body.coverageMode === 'highlights' ? 'highlights' : 'live';
  return json(await answerQuestion(body.message.trim(), teams, coverageMode));
}
