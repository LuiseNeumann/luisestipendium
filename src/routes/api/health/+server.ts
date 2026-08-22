import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export function GET() {
  const row = getDb().prepare('SELECT COUNT(*) AS games FROM games').get() as { games: number };
  return json({ status: 'ok', games: row.games });
}
