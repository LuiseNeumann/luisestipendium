import { json } from '@sveltejs/kit';
import { getDataBounds, getPackages, getTournamentRanges } from '$lib/server/db';

export function GET() {
  return json({ packages: getPackages(), dateBounds: getDataBounds(), tournaments: getTournamentRanges() });
}
