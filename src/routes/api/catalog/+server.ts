import { json } from '@sveltejs/kit';
import { getDataBounds, getPackages, listTournaments } from '$lib/server/db';

export function GET() {
  return json({ packages: getPackages(), dateBounds: getDataBounds(), tournaments: listTournaments() });
}
