import { getDb, importCsvData } from '../src/lib/server/db.js';

const database = getDb({ importData: false });
importCsvData(database, true);

const counts = database
  .prepare(`
    SELECT
      (SELECT COUNT(*) FROM games) AS games,
      (SELECT COUNT(*) FROM streaming_packages) AS packages,
      (SELECT COUNT(*) FROM streaming_offers) AS offers
  `)
  .get();

console.log('CSV-Import abgeschlossen:', counts);
database.close();
