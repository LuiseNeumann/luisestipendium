# Anforderungsanalyse – Streaming-Paket-Vergleichsplattform

**Projekt:** CHECK24 TechUp Stipendium Coding Challenge (Runde 2)
**Rolle dieses Dokuments:** Anforderungsanalyse aus Projektmanagement-Sicht, als Grundlage für Planung, Priorisierung und Abnahme.

---

## 1. Projektüberblick

### 1.1 Ausgangslage
Fans einzelner Fußballmannschaften müssen aktuell selbst recherchieren, welche Streaming-Anbieter (Magenta Sport, Amazon Prime, Sky u. a.) welche Spiele ihrer Teams übertragen. Bei mehreren Wettbewerben (Bundesliga, Champions League) ist keine einzelne Plattform vollständig abdeckend – Nutzer müssten mehrere Abos kombinieren, ohne einen Überblick über Kosten und Abdeckung zu haben.

### 1.2 Projektziel
Entwicklung einer Webanwendung, die für vom Nutzer ausgewählte Teams automatisch die kostengünstigste Kombination aus Streaming-Paketen ermittelt, diese verständlich und überzeugend visualisiert, und den Auswahlprozess durch einen KI-gestützten Chatbot vereinfacht.

### 1.3 Auftraggeber / Bewertungsgremium
CHECK24 (TechUp Stipendium), Kontakt: techup@check24.de

### 1.4 Ausführende Person
Luise (Einzelprojekt im Rahmen der Bewerbung)

---

## 2. Stakeholder

| Stakeholder | Rolle | Interesse |
|---|---|---|
| CHECK24 / Jury | Bewertende Instanz | Code-Qualität, Performance, UX, Kreativität, Dokumentation |
| Endnutzer (fiktiv, im Demo-Kontext) | Zielgruppe der App | Schnell & günstig alle Spiele der Lieblingsteams sehen können |
| Luise | Entwicklerin / Bewerberin | Stipendium erhalten, technisch überzeugendes Portfolio-Projekt |

---

## 3. Funktionale Anforderungen (MoSCoW-Priorisierung)

### Must-have (offizielle Minimum Requirements der Challenge)
| ID | Anforderung |
|---|---|
| F-01 | Nutzer kann eine oder mehrere Mannschaften auswählen |
| F-02 | System rankt Streaming-Pakete nach Abdeckung der ausgewählten Spiele |
| F-03 | System berechnet die günstigste Paket-Kombination, falls kein einzelnes Paket alle Spiele abdeckt |
| F-04 | Suchzeit bleibt UX-verträglich (keine spürbaren Wartezeiten bei der Optimierung) |
| F-05 | Anwendung ist über eine bedienbare UI nutzbar (kein reines CLI-Script) |

### Should-have (vom Projekt selbst gesetzte Zusatzanforderungen)
| ID | Anforderung |
|---|---|
| F-06 | Zeitliche Staffelung: System schlägt alternativ monatsweise Buchung statt Jahresabo vor, wenn günstiger |
| F-07 | Ersparnis-Visualisierung: Vergleich „naiver Kauf“ vs. optimierte Kombination, prominent dargestellt |
| F-08 | Spar-Score: prozentuale Kennzahl, wie nah die gefundene Lösung am theoretischen Optimum liegt |
| F-09 | Erklärbarkeits-Panel: pro Paket transparent, welche Spiele es abdeckt und was es zur Ersparnis beiträgt |
| F-10 | RAG-Chatbot beantwortet Nutzerfragen zu Teams, Paketen und der gewählten Kombination auf Basis der App-Daten |
| F-11 | Design lehnt sich visuell an CHECK24 an (Farbpalette, Kartenlayout) |

### Could-have (falls Zeit bleibt)
| ID | Anforderung |
|---|---|
| F-12 | „Was-wäre-wenn“-Slider zur Live-Anpassung der Team-Auswahl |
| F-13 | Haushalts-/WG-Modus mit Kostenteilung |
| F-14 | Kalender-Export (ICS) der relevanten Spiele |
| F-15 | Sprachgesteuerte Team-Suche über den Chatbot |

### Won't-have (bewusst außerhalb des Projektumfangs)
- Echte Zahlungsabwicklung / Vertragsabschluss mit Anbietern
- Mehrsprachigkeit (Fokus liegt auf funktionalem Prototyp)
- Native Mobile Apps (iOS/Android) – Web-App genügt für die Challenge

---

## 4. Nicht-funktionale Anforderungen

| Kategorie | Anforderung |
|---|---|
| Performance | Optimierungs-Berechnung liefert Ergebnis in einer für die UI akzeptablen Zeit (Zielwert: wenige Sekunden), auch bei größeren Datenmengen über Fallback-Heuristik sichergestellt |
| Usability | Bedienung ohne Vorwissen möglich; Ergebnisse auf einen Blick verständlich |
| Nachvollziehbarkeit | Optimierungsergebnis muss für den Nutzer nachvollziehbar sein (siehe F-09) |
| Wartbarkeit | Sauberer, modularer Code; Trennung von Datenmodell, Optimierungslogik, API und UI |
| Reproduzierbarkeit | Projekt muss mit einem Befehl lokal lauffähig sein (Docker Compose) |
| Dokumentation | README erklärt Architektur und Optimierungsansatz verständlich für die Jury |
| Sicherheit | API-Keys (OpenAI) nur über Umgebungsvariablen, nicht im Repository |

---

## 5. Rahmenbedingungen & Annahmen

- **Tech-Stack:** SvelteKit (Frontend & Backend), OpenAI API für den RAG-Chatbot.
- **Datenquelle:** Drei CSV-Dateien (Games, Streaming Packages, Streaming Offers) von CHECK24 – **Status: angefragt, noch nicht erhalten.** Bis zum Erhalt wird mit synthetischen Testdaten im gleichen Schema gearbeitet.
- **Annahme zur Staffelung:** Mindest-Buchungsdauer für Monatsabos wird vorläufig mit 1 Monat angenommen, bis reale Preisdaten vorliegen und diese Annahme validiert werden kann.
- **Abgabeform:** Privates GitHub-Repository mit Leserechten für techup@check24.de; lokale Lauffähigkeit via Docker Compose oder alternativ Demo-Video/Hosting-Link.
- **Zeitrahmen:** Nicht offiziell vorgegeben, faktisch begrenzt durch die Bewerbungsfrist des Stipendiums (im Rahmen dieses Projekts nicht spezifiziert).

---

## 6. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Datensatz trifft spät ein | Verzögerung bei Tests mit Echtdaten | Entwicklung parallel mit synthetischen Daten im identischen Schema |
| ILP-Solver skaliert bei großen Datenmengen schlecht | Suchzeit verletzt F-04 | Greedy-Fallback mit Timeout als Sicherheitsnetz |
| RAG-Chatbot liefert bei unklaren Fragen ungenaue Antworten | Vertrauensverlust in die App | Antworten strikt auf abgerufenen Kontext stützen, bei Unsicherheit auf UI-Ergebnisse verweisen statt zu spekulieren |
| Scope-Kriechen durch viele „Could-have“-Ideen | Must-have-Anforderungen geraten in Zeitverzug | Strikte Priorisierung nach MoSCoW; Could-haves erst nach vollständiger Erfüllung der Must-/Should-haves angehen |
| OpenAI-API-Kosten/Limits während der Entwicklung | Unterbrechung der Chatbot-Tests | Kleines Kontingent/Budget einplanen, lokale Mock-Antworten für UI-Entwicklung nutzen |

---

## 7. Abnahmekriterien

- Alle Must-have-Anforderungen (F-01 bis F-05) sind vollständig und nachweisbar erfüllt.
- Mindestens die in F-06 bis F-11 beschriebenen Should-have-Features sind funktionsfähig integriert.
- Projekt lässt sich gemäß README lokal starten (Docker Compose) **oder** es liegt ein aussagekräftiges Demo-Video/Hosting-Link vor.
- README erklärt den Optimierungsansatz nachvollziehbar (inkl. Umgang mit Performance-Trade-offs).
- Repository ist privat, mit Leserechten für techup@check24.de versehen.

---

## 8. Verbindung zum Entwicklungsplan

Diese Anforderungsanalyse bildet die Grundlage für die acht Phasen im `entwicklungsplan.md`. Die Phasen 1–3 decken die Must-have-Anforderungen (F-01 bis F-05) ab, Phasen 4–7 die Should-have-Anforderungen (F-06 bis F-11), die in Abschnitt 3 gelisteten Could-have-Punkte sind als optionale Erweiterung am Ende des Entwicklungsplans vermerkt.
