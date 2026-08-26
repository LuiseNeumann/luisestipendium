# Streaming Check

Streaming Check ermittelt für bis zu acht ausgewählte Fußballmannschaften und einen frei wählbaren Zeitraum die günstigste Kombination aus Live-Streaming-Paketen. Die Anwendung vergleicht eine statische Jahresstrategie mit einer zeitlich gestaffelten Buchung und erklärt jeden Preisbestandteil.

## Schnellstart

Voraussetzungen: Node.js 22 oder Docker.

```bash
cp .env.example .env
npm install
npm run dev
```

Die Anwendung ist anschließend unter `http://localhost:5173` erreichbar. Ein OpenAI-Key ist optional; ohne Key verwendet der Streaming-Berater ausschließlich lokale, aus dem Optimierungsergebnis erzeugte Antworten.

Mit Docker läuft das gesamte Projekt mit einem Befehl:

```bash
docker compose up --build
```

Danach ist Streaming Check unter `http://localhost:3000` erreichbar. Die automatisch importierte SQLite-Datenbank liegt in einem Docker-Volume.

## Funktionen

- Suche und Mehrfachauswahl aus 941 Mannschaften
- Frei wählbarer Datumsbereich für Live-Spiele
- Optionaler Turnierfilter, der den Datumsbereich automatisch auf die vorhandenen Turnierspiele setzt
- Bereits vorhandene Abos werden als 0,00 € Zusatzkosten berücksichtigt
- Kostenlose Angebote von ARD, ZDF und weiteren Anbietern separat ausgewiesen
- Exakte binäre Set-Cover-Optimierung über GLPK
- Greedy-Fallback für große Instanzen oder nicht rechtzeitig gelöste Modelle
- Vergleich von Jahresabos und monatsweise gebuchten Paketen
- Bis zu drei vollständige Alternativkombinationen
- Euro-Preise, Kostenformel, Ersparnis und transparente Paket-Spiel-Zuordnung
- RAG-Streaming-Berater mit persistenten OpenAI-Embeddings in SQLite
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

`monthly_price_yearly_subscription_in_cents` wird als monatlicher Preis bei zwölf Monaten Bindung interpretiert. Entsprechend betragen die Jahreskosten den Feldwert mal zwölf. Eine leere Preisangabe bedeutet, dass diese Buchungsart nicht angeboten wird. Insbesondere wird für `MagentaTV - MegaSport` deshalb kein kündbarer Monatstarif erfunden: `60,00 € × 12 = 720,00 €` pro Bindungszeitraum.

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

Bereits vorhandene Pakete decken ihre Spiele im gewählten Zeitraum ohne weitere Kosten ab. Diese Annahme wird in der Eingabe und jeder betroffenen Paketzeile sichtbar ausgewiesen. Die Alternativsuche schließt Pakete der optimalen Lösung schrittweise aus und löst das vollständige Modell erneut; dadurch entstehen bis zu drei Kombinationen mit tatsächlich anderen kostenpflichtigen Anbietern.

## Ersparnis

Der Referenzwert ist nicht mehr der unrealistische Kauf aller am Markt vorkommenden Pakete. Stattdessen gilt transparent:

```text
günstigste vollständige Jahresstrategie
− günstigste zeitoptimierte Kombination
= ausgewiesene Ersparnis
```

## RAG-Streaming-Berater

Mit `OPENAI_API_KEY` werden Pakete, Preise, Teams und FAQ-Texte über `text-embedding-3-small` eingebettet. Die Vektoren werden anhand eines Inhalts-Hashes in SQLite wiederverwendet. Für eine Frage werden die sechs ähnlichsten Chunks per Kosinusähnlichkeit abgerufen und gemeinsam mit dem serverseitig neu berechneten Solver-Ergebnis an das konfigurierte Chatmodell übergeben. Function Calling kann eine neue Teamauswahl an die UI zurückgeben.

Ohne Key oder bei einem API-Fehler beantwortet eine lokale Logik Fragen zu Kosten, Spielen und Paketbegründungen. Sie arbeitet ausschließlich mit dem aktuellen Solver-Ergebnis.

## API

- `GET /api/teams?q=bayern`: Teamsuche
- `GET /api/catalog`: Pakete, Turniere und verfügbarer Datumsbereich
- `GET /api/games?team=Bayern+München&start=2024-07-01&end=2025-06-01&tournament=Bundesliga+24%2F25`: Spiele und Angebote
- `POST /api/optimize`: `{ "teams": [...], "startDate": "2024-07-01", "endDate": "2025-06-01", "tournament": "Bundesliga 24/25", "existingPackageIds": [...] }`
- `POST /api/chat`: dieselben Kontextfelder plus `message`
- `GET /api/health`: Container-Healthcheck

## Qualitätssicherung

```bash
npm run check
npm test
npm run build
```

Der manuelle Neuimport der CSV-Dateien erfolgt mit `npm run db:import`.

Ergibt die Kombination aus Teams, Zeitraum und Turnier keine Spiele, zeigt die UI eine Diagnose mit allen angewendeten Filtern und passenden Korrekturhinweisen statt leerer Preisempfehlungen.

## Noch außerhalb des Umfangs

Die optionalen Ideen Haushaltsmodus, ICS-Export, Was-wäre-wenn-Regler und Sprachsteuerung sind nicht Bestandteil dieser ersten vollständigen Ausbaustufe. Zahlungsabwicklung und Vertragsabschluss sind bewusst ausgeschlossen.
