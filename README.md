# SparSpiel

SparSpiel ermittelt für bis zu acht ausgewählte Fußballmannschaften die günstigste Kombination aus Streaming-Paketen. Die Anwendung vergleicht eine statische Jahresstrategie mit einer monatsweise gestaffelten Buchung und erklärt, welches Paket welche Spiele abdeckt.

## Schnellstart

Voraussetzungen: Node.js 22 oder Docker.

```bash
cp .env.example .env
npm install
npm run dev
```

Die Anwendung ist anschließend unter `http://localhost:5173` erreichbar. Ein OpenAI-Key ist optional; ohne Key verwendet der Sparberater ausschließlich lokale, aus dem Optimierungsergebnis erzeugte Antworten.

Mit Docker läuft das gesamte Projekt mit einem Befehl:

```bash
docker compose up --build
```

Danach ist SparSpiel unter `http://localhost:3000` erreichbar. Die automatisch importierte SQLite-Datenbank liegt in einem Docker-Volume.

## Funktionen

- Suche und Mehrfachauswahl aus 941 Mannschaften
- Getrennte Optimierung für Live-Übertragungen und Highlights
- Exakte binäre Set-Cover-Optimierung über GLPK
- Greedy-Fallback für große Instanzen oder nicht rechtzeitig gelöste Modelle
- Vergleich von Jahresabos und monatsweise gebuchten Paketen
- Euro-Preise, Ersparnis, Spar-Score und transparente Paket-Spiel-Zuordnung
- RAG-Sparberater mit persistenten OpenAI-Embeddings in SQLite
- Datenbasierter lokaler Chat-Fallback ohne API-Key
- Responsive Oberfläche für Desktop und Mobilgeräte

## Architektur

```text
src/
├── lib/
│   ├── components/          UI-Bausteine für Auswahl, Pläne und Chat
│   ├── server/
│   │   ├── db.ts            Schema, CSV-Import und Datenzugriff
│   │   ├── optimizer.ts     ILP-Modell und Greedy-Fallback
│   │   └── chat.ts          Retrieval, OpenAI und lokaler Fallback
│   ├── format.ts            Euro- und Datumsformatierung
│   └── types.ts             Gemeinsame API-Datentypen
└── routes/
    ├── api/                 Teams, Spiele, Optimierung, Chat, Healthcheck
    └── +page.svelte         Vergleichsoberfläche
tests/                       Datenbank- und Solver-Tests
scripts/import-data.ts       Manueller, reproduzierbarer CSV-Import
```

SvelteKit stellt UI und JSON-API in einem Node-Prozess bereit. Beim ersten Datenzugriff wird `data/streaming.db` angelegt und aus den drei Challenge-CSV-Dateien befüllt. Geldwerte bleiben intern in Cent und werden erst für die Ausgabe in Euro formatiert.

## Datenmodell

- `games`: Heimteam, Auswärtsteam, Startzeit und Wettbewerb
- `streaming_packages`: Paketname
- `package_prices`: normalisierte Monats- und 12-Monats-Tarife
- `streaming_offers`: Zuordnung Spiel/Paket mit separaten Live- und Highlight-Markierungen
- `knowledge_embeddings`: persistente RAG-Chunks und Embedding-Vektoren

`monthly_price_yearly_subscription_in_cents` wird als monatlicher Preis bei zwölf Monaten Bindung interpretiert. Entsprechend betragen die Jahreskosten den Feldwert mal zwölf. Eine leere Preisangabe bedeutet, dass diese Buchungsart nicht angeboten wird.

### Datenqualität

Die gelieferte Datei `bc_streaming_offer.csv` enthält 1.897 Angebote für Paket-ID 37. Für diese ID existiert in `bc_streaming_package.csv` weder ein Name noch ein Preis. Diese verwaisten Angebote werden beim Import bewusst protokolliert und übersprungen, da eine Annahme über ihren Preis das Optimierungsergebnis verfälschen würde.

## Optimierungsansatz

### Statische Kombination

Für jedes Paket wird eine binäre Variable `x_p` angelegt. Die Zielfunktion minimiert die Summe der Jahreskosten:

```text
minimiere  Σ kosten(p) × x_p
```

Für jedes abdeckbare Spiel erzwingt eine Nebenbedingung, dass mindestens eines seiner Pakete gewählt wird:

```text
für jedes Spiel s:  Σ x_p >= 1  für alle Pakete p, die s übertragen
```

### Zeitliche Staffelung

Zusätzlich zu Jahresvariablen entstehen Variablen für jede tatsächlich benötigte Paket-Monat-Kombination. Eine Monatsvariable deckt ausschließlich Spiele in diesem Kalendermonat ab. Jahresvariablen decken jeweils ein echtes Fenster von zwölf aufeinanderfolgenden Monaten ab; umfasst der Datensatz einen längeren Zeitraum, muss der Solver entsprechend mehrere Bindungszeiträume bezahlen. GLPK kann dadurch Jahresbindung und flexible Einzelmonate im selben Modell gegeneinander abwägen.

Modelle mit höchstens 1.000 Variablen und 1.500 Spielen werden mit einem Zeitlimit von zwei Sekunden als binäres ILP gelöst. Größere Instanzen gehen direkt in den Greedy-Fallback. Dieser wählt iterativ das Paket mit dem besten Verhältnis aus neu abgedeckten Spielen und Kosten. Das Ergebnis kennzeichnet transparent, ob es exakt oder schnell optimiert wurde.

Spiele ohne gültiges Angebot werden in der UI ausgewiesen und nicht fälschlich als abgedeckt gezählt.

## Ersparnis und Spar-Score

Der Referenzwert ist der Jahreskauf aller Pakete, die mindestens eines der ausgewählten Spiele abdecken. Davon werden die Kosten der günstigeren Strategie abgezogen. Sind beide ILP-Modelle exakt gelöst, erreicht die gewählte Lösung den Spar-Score 100. Bei Verwendung der zeitbegrenzten Näherung wird dies sichtbar auf 95 begrenzt und als schnelle Optimierung bezeichnet.

## RAG-Sparberater

Mit `OPENAI_API_KEY` werden Pakete, Preise, Teams und FAQ-Texte über `text-embedding-3-small` eingebettet. Die Vektoren werden anhand eines Inhalts-Hashes in SQLite wiederverwendet. Für eine Frage werden die sechs ähnlichsten Chunks per Kosinusähnlichkeit abgerufen und gemeinsam mit dem serverseitig neu berechneten Solver-Ergebnis an das konfigurierte Chatmodell übergeben. Function Calling kann eine neue Teamauswahl an die UI zurückgeben.

Ohne Key oder bei einem API-Fehler beantwortet eine lokale Logik Fragen zu Kosten, Spielen und Paketbegründungen. Sie arbeitet ausschließlich mit dem aktuellen Solver-Ergebnis.

## API

- `GET /api/teams?q=bayern`: Teamsuche
- `GET /api/games?team=FC+Bayern+München`: Spiele, Pakete und Übertragungsarten
- `POST /api/optimize`: `{ "teams": [...], "coverageMode": "live" | "highlights" }`
- `POST /api/chat`: `{ "message": "...", "teams": [...], "coverageMode": "live" | "highlights" }`
- `GET /api/health`: Container-Healthcheck

## Qualitätssicherung

```bash
npm run check
npm test
npm run build
```

Der manuelle Neuimport der CSV-Dateien erfolgt mit `npm run db:import`.

## Noch außerhalb des Umfangs

Die optionalen Ideen Haushaltsmodus, ICS-Export, Was-wäre-wenn-Regler und Sprachsteuerung sind nicht Bestandteil dieser ersten vollständigen Ausbaustufe. Zahlungsabwicklung und Vertragsabschluss sind bewusst ausgeschlossen.
