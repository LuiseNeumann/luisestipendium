# Entwicklungsplan – CHECK24 TechUp Streaming Package Comparison Challenge

> Ziel: Vergleichsplattform für Streaming-Pakete zur Übertragung von Fußballspielen, inkl. RAG-Chatbot, Ersparnis-Visualisierung, zeitlicher Staffelung, Spar-Score und Erklärbarkeit der Optimierung. Design an CHECK24 angelehnt.

**Tech-Stack:** SvelteKit (Frontend & Backend-Routes), OpenAI API (RAG-Chatbot), ILP-Solver (PuLP/OR-Tools) für die Kombinatorik.

---

## Phase 1 – Datenmodell & Backend-Grundgerüst

- SQLite/PostgreSQL-Schema für `Games`, `Streaming Packages`, `Streaming Offers` anlegen – 1:1 an die CSV-Struktur angelehnt.
- Zusätzliches Feld für Paket-Laufzeit (monatlich/jährlich) und Preis pro Laufzeit ergänzen (Basis für Phase 4).
- SvelteKit-API-Routes für Team-Suche, Spielabruf und Paket-Zuordnung bauen.
- **Blocker:** CSV-Datensatz von CHECK24 steht noch aus → mit synthetischen Testdaten im gleichen Schema starten, später austauschen.

## Phase 2 – Team- & Spiel-Matching-Logik

- Endpoint: zu einer oder mehreren ausgewählten Mannschaften alle relevanten Spiele sammeln (Bundesliga, Champions League, etc.).
- Für jedes Spiel: verfügbare Pakete auflisten (Live und Highlights getrennt ausweisen).
- Spieldatum mitführen – wird in Phase 4 für die zeitliche Staffelung benötigt.

## Phase 3 – Kombinatorik-Algorithmus: Statische Kombination

- Weighted-Set-Cover-Problem formulieren: jedes Paket deckt eine Teilmenge der Spiele ab, mit Jahreskosten.
- Kleine Instanzen: exakte Lösung via ILP (PuLP/OR-Tools).
- Große Instanzen: Greedy-Algorithmus (günstigste Kosten pro neu abgedecktem Spiel) mit Timeout als Fallback.
- Ergebnis: günstigste Jahres-Kombination (erfüllt die offiziellen Minimum Requirements der Challenge).

## Phase 4 – Zeitliche Staffelung statt Jahresabo

- Optimierungsproblem um die Zeitachse erweitern: prüfen, ob monatsweise Buchung nur in Zeiträumen mit tatsächlichen Spielen günstiger ist.
- Spiele nach Datum clustern (Lücke > X Wochen = neues Buchungsfenster).
- Pro Cluster: monatlicher vs. jährlicher Preis je Paket vergleichen.
- ILP-Formulierung um Zeit-Dimension erweitern (Variable: Paket X gebucht in Monat Y).
- UI zeigt „Jahresabo“ vs. „Gestaffelt gebucht“ nebeneinander mit jeweiliger Ersparnis.
- Annahme (bis echte Preisdaten vorliegen): Mindest-Buchungsdauer = 1 Monat.

## Phase 5 – Ersparnis-Berechnung, Spar-Score & Marketing-Visualisierung

- Referenzwert berechnen: Kosten bei naivem Kauf aller nötigen Pakete vs. optimierte statische Kombination vs. gestaffelte Kombination.
- Ersparnis groß und emotional darstellen (animierter „Du sparst X €“-Counter, Balken-/Donut-Chart).
- **Spar-Score:** `(Ersparnis der gewählten Lösung / theoretisch maximal mögliche Ersparnis) × 100`, dargestellt als Prozentwert/Badge („Deine Kombination ist zu 96 % optimal“).

## Phase 6 – RAG-Chatbot mit OpenAI

- Wissensbasis (Teams, Pakete, Preise, FAQ) in Embeddings umwandeln (`text-embedding-3-small`).
- Vektorstore aufsetzen (Chroma oder pgvector).
- Bei Nutzeranfrage: Embedding erzeugen → relevante Kontext-Chunks abrufen → zusammen mit Frage an GPT senden.
- Function Calling nutzen, damit der Chatbot direkt Team-Auswahl auslösen oder die Erklärbarkeits-Ausgabe aus Phase 7 versprachlichen kann.

## Phase 7 – Erklärbarkeit der Optimierung

- „Warum diese Kombination?“-Panel: pro Paket auflisten, welche Spiele es abdeckt, Beitrag zur Gesamtersparnis, Live/Highlights-Status.
- Der Solver liefert die Zuordnung Paket → abgedeckte Spiele ohnehin als Nebenprodukt – strukturiert weiterreichen statt nur die Endsumme.
- UI: aufklappbare Liste je Paket, kleine Icons pro abgedecktem Spiel.

## Phase 8 – CHECK24-Style Frontend, Docker & Abgabe

- Farbpalette an CHECK24 anlehnen (kräftiges Blau, Gelb/Orange als CTA-Akzent, abgerundete Karten, viel Weißraum).
- UI-Bausteine: Team-Auswahl, Ergebniskarten (Jahresabo vs. gestaffelt), Ersparnis-Widget + Spar-Score oben, Erklärbarkeits-Panel je Karte, Chatbot als Slide-in-Panel.
- `docker-compose.yaml` + `.env.example` (OpenAI-Key) erstellen.
- README mit Architektur- und Optimierungserklärung schreiben.
- Demo-Video oder Hosting-Link ergänzen.
- Privates Repo anlegen, Leserechte an `techup@check24.de` geben, Link bei der Bewerbung einreichen.

---

## Zusätzliche Ideen (optional, falls Zeit bleibt)

- „Was-wäre-wenn“-Slider: Team live hinzufügen, Kombination & Ersparnis aktualisieren sich in Echtzeit.
- Haushalts-/WG-Modus: mehrere Nutzer mit unterschiedlichen Teams, faire Kostenteilung.
- Kalender-Export (ICS) aller relevanten Spiele inkl. benötigtem Paket.
- Sprachgesteuerte Team-Suche über den Chatbot (Web Speech API).
