# toggl32

## Context

Lokale React-Webanwendung die über die Toggl Track API alle gearbeiteten Stunden seit einem konfigurierbaren Startdatum (default: 05.01.2025) abruft. Ziel: 32h/Woche bei
4-Tage-Woche. Über-/Unterstunden werden auf einem Plusstundenkonto kumuliert. Die App zeigt das Konto prominent an + aktuelle Wochenstunden + Wochenhistorie.

---

Gesammelte Anforderungen (Interview-Ergebnisse)

Tech Stack

- Package-Manager: pnpm
- Frontend: Vite + React + TypeScript
- UI: shadcn/ui + Tailwind CSS
- Backend: Express.js (Node) – minimaler Proxy + JSON-Persistenz
- Theme: Dark/Light Toggle + System-Präferenz

Daten & API

- Auth: API Token in .env (hardcoded), Backend liest ihn
- API-Routing: Frontend → Express Backend → Toggl API (Token bleibt im Backend)
- Workspace: Nur ein bestimmter Workspace zählt (konfigurierbar in .env)
- Refresh: Nur beim Seitenaufruf, kein Auto-Refresh
- Startdatum: Konfigurierbar (.env)

Berechnung

- Wochensoll: 32h
- Arbeitstage: 4 Tage/Woche → 8h/Tag
- Urlaub/Feiertage: Pro Woche können einzelne Tage als frei markiert werden → Soll reduziert sich (z.B. 1 Tag frei = 32h - 8h = 24h Soll)
- Plusstundenkonto: Summe aller (Ist - Soll) über alle abgeschlossenen Wochen

UI/UX

- Hauptanzeige: Zentriert minimal – Plusstundenkonto als riesige Zahl, Wochenstunden klein darunter/daneben
- Zeitformat: Stunden:Minuten (h:mm)
- Farben: Dezent farbig (Plus = grünlich, Minus = rötlich, Neutral = standard)
- Aktuelle Woche: Fortschrittsbalken (nur Ist, kein Erwartungs-Marker)
- Wochenhistorie: Immer sichtbar, scrollbare Liste mit Soll + Ist + Differenz pro Woche
- Urlaub-UI: Tage-Picker pro Woche in der Historie

Persistenz

- JSON-Datei lokal auf dem Filesystem (via Express-Backend)
- Speichert: Urlaubstage pro Woche, ggf. weitere Config

---

Implementierungsschritte

1.  Projekt-Setup

- Vite + React + TypeScript initialisieren
- Tailwind CSS + shadcn/ui einrichten
- Express.js Backend aufsetzen (separater Ordner server/)
- .env-Datei mit: TOGGL_API_TOKEN, TOGGL_WORKSPACE_ID, START_DATE, PORT
- Concurrent dev-script: Frontend + Backend parallel starten (concurrently)

2.  Backend (Express.js) – server/

- server/index.ts – Express-Server mit folgenden Routen:
  - GET /api/hours – Holt alle Zeiteinträge von Toggl seit Startdatum, gruppiert nach Wochen, gibt Stunden pro Woche zurück
  - GET /api/config – Gibt aktuelle Config zurück (Startdatum, Arbeitstage, etc.)
  - GET /api/days-off – Liest freie Tage aus JSON-Datei
  - PUT /api/days-off – Schreibt freie Tage in JSON-Datei
- server/toggl.ts – Toggl API Client (Reports API v3 oder Time Entries API)
  - Authentifizierung via Basic Auth mit API Token
  - Abruf aller Time Entries seit Startdatum für den konfigurierten Workspace
- server/data.json – Persistenz-Datei für freie Tage
- CORS erlauben für localhost

3.  Frontend – Datenlogik

- src/api.ts – Fetch-Funktionen für die Backend-Routen
- src/utils/hours.ts – Berechnungslogik:
  - Wochen seit Startdatum berechnen
  - Pro Woche: Soll berechnen (32h - freie Tage × 8h)
  - Differenz Ist - Soll pro Woche
  - Plusstundenkonto = Summe aller Differenzen abgeschlossener Wochen
  - Zeitformatierung: Minuten → h:mm

4.  Frontend – UI-Komponenten

- src/App.tsx – Hauptlayout, Theme-Provider
- src/components/PlusAccount.tsx – Große Zahl: Plusstundenkonto (farbcodiert dezent)
- src/components/CurrentWeek.tsx – Kleine Zahl + Fortschrittsbalken (aktuell/32h)
- src/components/WeekHistory.tsx – Scrollbare Liste aller Wochen (Soll, Ist, Differenz)
- src/components/DayOffPicker.tsx – Tage-Picker pro Woche (Mo-Do togglebar)
- src/components/ThemeToggle.tsx – Dark/Light/System Toggle

5.  Theme

- shadcn/ui Theme-System nutzen (CSS-Variablen)
- Dark/Light Toggle + prefers-color-scheme Media Query als Default
- Toggle-Button in der oberen Ecke

---

Datei-Struktur

```
toggl32/
├── server/
│ ├── index.ts # Express-Server
│ ├── toggl.ts # Toggl API Client
│ ├── data.json # Persistenz (freie Tage)
│ └── tsconfig.json
├── src/
│ ├── api.ts # Backend-API Aufrufe
│ ├── utils/
│ │ └── hours.ts # Berechnung & Formatierung
│ ├── components/
│ │ ├── PlusAccount.tsx
│ │ ├── CurrentWeek.tsx
│ │ ├── WeekHistory.tsx
│ │ ├── DayOffPicker.tsx
│ │ └── ThemeToggle.tsx
│ ├── App.tsx
│ └── main.tsx
├── .env
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── prd.md
```

---

Verifikation

1.  npm run dev startet Frontend + Backend
2.  Frontend zeigt Plusstundenkonto als große Zahl (korrekt berechnet seit Startdatum)
3.  Aktuelle Wochenstunden werden mit Fortschrittsbalken angezeigt
4.  Wochenhistorie zeigt alle Wochen mit Soll/Ist/Differenz
5.  Freie Tage können pro Woche markiert werden → Soll passt sich an
6.  Dark/Light Toggle funktioniert + System-Präferenz wird respektiert
7.  Daten persistieren nach Neustart (JSON-Datei)
