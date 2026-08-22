import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CoverageMode, Game, GameOffer, StreamingPackage } from '$lib/types';

const databasePath = process.env.DATABASE_PATH ?? resolve('data/streaming.db');
let database: Database.Database | undefined;

interface GameCsvRow {
  id: string;
  team_home: string;
  team_away: string;
  starts_at: string;
  tournament_name: string;
}

interface PackageCsvRow {
  id: string;
  name: string;
  monthly_price_cents: string;
  monthly_price_yearly_subscription_in_cents: string;
}

interface OfferCsvRow {
  game_id: string;
  streaming_package_id: string;
  live: string;
  highlights: string;
}

function readCsv<T>(filename: string): T[] {
  const path = resolve(filename);
  if (!existsSync(path)) throw new Error(`CSV-Datei fehlt: ${path}`);
  return parse(readFileSync(path), { columns: true, skip_empty_lines: true, trim: true }) as T[];
}

function createSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY,
      team_home TEXT NOT NULL,
      team_away TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      tournament_name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS streaming_packages (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS package_prices (
      package_id INTEGER NOT NULL REFERENCES streaming_packages(id),
      billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
      commitment_months INTEGER NOT NULL CHECK (commitment_months IN (1, 12)),
      monthly_price_cents INTEGER NOT NULL CHECK (monthly_price_cents >= 0),
      PRIMARY KEY (package_id, billing_period)
    );
    CREATE TABLE IF NOT EXISTS streaming_offers (
      game_id INTEGER NOT NULL REFERENCES games(id),
      package_id INTEGER NOT NULL REFERENCES streaming_packages(id),
      live INTEGER NOT NULL CHECK (live IN (0, 1)),
      highlights INTEGER NOT NULL CHECK (highlights IN (0, 1)),
      PRIMARY KEY (game_id, package_id)
    );
    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      model TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS games_home_idx ON games(team_home);
    CREATE INDEX IF NOT EXISTS games_away_idx ON games(team_away);
    CREATE INDEX IF NOT EXISTS offers_game_idx ON streaming_offers(game_id);
    CREATE INDEX IF NOT EXISTS offers_package_idx ON streaming_offers(package_id);
  `);
}

export function importCsvData(db: Database.Database, force = false) {
  const gameCount = db.prepare('SELECT COUNT(*) AS count FROM games').get() as { count: number };
  if (gameCount.count > 0 && !force) return;

  const games = readCsv<GameCsvRow>('bc_game.csv');
  const packages = readCsv<PackageCsvRow>('bc_streaming_package.csv');
  const offers = readCsv<OfferCsvRow>('bc_streaming_offer.csv');
  const packageIds = new Set(packages.map((row) => Number(row.id)));
  const validOffers = offers.filter((row) => packageIds.has(Number(row.streaming_package_id)));

  if (validOffers.length !== offers.length) {
    console.warn(
      `${offers.length - validOffers.length} Angebote mit unbekannter Paket-ID wurden übersprungen.`
    );
  }

  const importAll = db.transaction(() => {
    db.exec('DELETE FROM streaming_offers; DELETE FROM package_prices; DELETE FROM streaming_packages; DELETE FROM games;');
    const insertGame = db.prepare('INSERT INTO games VALUES (?, ?, ?, ?, ?)');
    const insertPackage = db.prepare('INSERT INTO streaming_packages VALUES (?, ?)');
    const insertPrice = db.prepare('INSERT INTO package_prices VALUES (?, ?, ?, ?)');
    const insertOffer = db.prepare('INSERT INTO streaming_offers VALUES (?, ?, ?, ?)');

    for (const row of games) {
      insertGame.run(Number(row.id), row.team_home, row.team_away, row.starts_at, row.tournament_name);
    }
    for (const row of packages) {
      const id = Number(row.id);
      insertPackage.run(id, row.name);
      if (row.monthly_price_cents !== '') {
        insertPrice.run(id, 'monthly', 1, Number(row.monthly_price_cents));
      }
      if (row.monthly_price_yearly_subscription_in_cents !== '') {
        insertPrice.run(id, 'annual', 12, Number(row.monthly_price_yearly_subscription_in_cents));
      }
    }
    for (const row of validOffers) {
      insertOffer.run(Number(row.game_id), Number(row.streaming_package_id), Number(row.live), Number(row.highlights));
    }
  });
  importAll();
}

export function getDb(options: { importData?: boolean } = {}) {
  if (database) return database;
  mkdirSync(dirname(databasePath), { recursive: true });
  database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  createSchema(database);
  if (options.importData !== false) importCsvData(database);
  return database;
}

export function listTeams(search = '', limit = 30): string[] {
  const query = `%${search.trim()}%`;
  const rows = getDb()
    .prepare(`
      SELECT team FROM (
        SELECT team_home AS team FROM games
        UNION
        SELECT team_away AS team FROM games
      )
      WHERE team LIKE ? COLLATE NOCASE
      ORDER BY CASE WHEN team LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END, team COLLATE NOCASE
      LIMIT ?
    `)
    .all(query, `${search.trim()}%`, limit) as { team: string }[];
  return rows.map((row) => row.team);
}

export function teamsExist(teams: string[]): boolean {
  if (teams.length === 0) return false;
  const available = new Set(listTeams('', 2_000));
  return teams.every((team) => available.has(team));
}

export function getGamesForTeams(teams: string[]): Game[] {
  if (teams.length === 0) return [];
  const placeholders = teams.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(`
      SELECT id, team_home, team_away, starts_at, tournament_name
      FROM games
      WHERE team_home IN (${placeholders}) OR team_away IN (${placeholders})
      ORDER BY starts_at, id
    `)
    .all(...teams, ...teams) as Array<{
    id: number;
    team_home: string;
    team_away: string;
    starts_at: string;
    tournament_name: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    homeTeam: row.team_home,
    awayTeam: row.team_away,
    startsAt: row.starts_at,
    tournament: row.tournament_name
  }));
}

export function getPackages(): StreamingPackage[] {
  const rows = getDb()
    .prepare(`
      SELECT p.id, p.name, pp.billing_period, pp.commitment_months, pp.monthly_price_cents
      FROM streaming_packages p
      JOIN package_prices pp ON pp.package_id = p.id
      ORDER BY p.id, pp.commitment_months
    `)
    .all() as Array<{
    id: number;
    name: string;
    billing_period: 'monthly' | 'annual';
    commitment_months: 1 | 12;
    monthly_price_cents: number;
  }>;
  const packages = new Map<number, StreamingPackage>();
  for (const row of rows) {
    const item = packages.get(row.id) ?? { id: row.id, name: row.name, prices: [] };
    item.prices.push({
      billingPeriod: row.billing_period,
      commitmentMonths: row.commitment_months,
      monthlyPriceCents: row.monthly_price_cents
    });
    packages.set(row.id, item);
  }
  return [...packages.values()];
}

export function getOffers(gameIds: number[], mode?: CoverageMode): GameOffer[] {
  if (gameIds.length === 0) return [];
  const placeholders = gameIds.map(() => '?').join(', ');
  const modeFilter = mode ? `AND ${mode} = 1` : '';
  const rows = getDb()
    .prepare(`
      SELECT game_id, package_id, live, highlights
      FROM streaming_offers
      WHERE game_id IN (${placeholders}) ${modeFilter}
    `)
    .all(...gameIds) as Array<{ game_id: number; package_id: number; live: 0 | 1; highlights: 0 | 1 }>;
  return rows.map((row) => ({
    gameId: row.game_id,
    packageId: row.package_id,
    live: row.live === 1,
    highlights: row.highlights === 1
  }));
}
