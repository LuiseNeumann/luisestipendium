import { json } from '@sveltejs/kit';
import { listTeams } from '$lib/server/db';

export function GET({ url }) {
  const query = url.searchParams.get('q') ?? '';
  return json({ teams: listTeams(query, 30) });
}
