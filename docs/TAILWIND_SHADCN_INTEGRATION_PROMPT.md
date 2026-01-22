# DNA ME CRM - Tailwind CSS & shadcn/ui Integration Prompt

## Projekt-Kontext

Das DNA ME CRM-Projekt verwendet aktuell:
- **React Admin** als Framework
- **Material-UI (MUI)** für UI-Komponenten
- **JavaScript (JSX)** statt TypeScript
- **Vite** als Build-Tool
- **Benutzerdefiniertes CSS** in `index.css`
- **Dark Mode Theme** mit Biotech-Design (#0a0a0f Hintergrund, #4A90A4 Akzentfarbe)

## Ziel

Integration von **Tailwind CSS** und **shadcn/ui** für moderne, konsistente UI-Komponenten, während die bestehende React Admin-Architektur erhalten bleibt.

---

## Angepasster Prompt für Komponenten-Integration

```
Du hast die Aufgabe, eine bestehende React-Komponente in das DNA ME CRM-Projekt zu integrieren.

Das Projekt sollte unterstützen:
- shadcn/ui Projektstruktur
- Tailwind CSS
- JavaScript (JSX) - TypeScript ist optional, aber nicht erforderlich
- React Admin Framework (bestehende Architektur beibehalten)
- Dark Mode Theme mit DNA ME Branding (#0a0a0f, #4A90A4)

### Projekt-Setup prüfen

1. **Tailwind CSS Setup**
   - Prüfe ob `tailwind.config.js` existiert
   - Prüfe ob `postcss.config.js` existiert
   - Prüfe ob Tailwind-Direktiven in `src/index.css` vorhanden sind
   - Falls nicht vorhanden: Installiere Tailwind CSS, PostCSS und Autoprefixer

2. **shadcn/ui Setup**
   - Prüfe ob `components.json` existiert
   - Prüfe ob `/src/components/ui` Ordner existiert
   - Falls nicht vorhanden: Initialisiere shadcn/ui mit `npx shadcn@latest init`
   - Stelle sicher, dass der Standard-Pfad für Komponenten `/src/components/ui` ist

3. **TypeScript (Optional)**
   - Das Projekt verwendet aktuell JavaScript (.jsx)
   - Neue Komponenten können in .jsx oder .tsx geschrieben werden
   - Wenn TypeScript verwendet wird, stelle sicher, dass `tsconfig.json` korrekt konfiguriert ist

### DNA ME CRM Branding & Theme

Das Projekt verwendet folgende Design-Tokens:
- **Hintergrund**: `#0a0a0f` (dark mode)
- **Akzentfarbe**: `#4A90A4` (DNA ME Blau)
- **Text**: `#e0e0e0` (heller Text auf dunklem Hintergrund)
- **Schriftart**: IBM Plex Sans
- **Border Radius**: 8px (entspricht Material-UI shape.borderRadius)

### Tailwind Config Anpassung

Die `tailwind.config.js` sollte folgende Farben enthalten:

```js
module.exports = {
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0a0a0f',
          paper: '#12121a',
        },
        foreground: '#e0e0e0',
        primary: {
          DEFAULT: '#4A90A4',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#6AAFC2',
          foreground: '#ffffff',
        },
        border: '#2a2a3a',
        muted: {
          DEFAULT: '#1a1a24',
          foreground: '#a0a0a0',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
}
```

### Komponenten-Integration

Wenn eine Komponente integriert werden soll:

1. **Komponente analysieren**
   - Identifiziere alle benötigten Abhängigkeiten
   - Prüfe ob shadcn/ui Komponenten verwendet werden (Button, Card, etc.)
   - Prüfe ob externe Icons benötigt werden (lucide-react)

2. **Komponente anpassen**
   - Ersetze generische Farben mit DNA ME Theme-Farben
   - Stelle sicher, dass Dark Mode korrekt funktioniert
   - Verwende `className` statt `sx` Props (Material-UI → Tailwind Migration)
   - Passe Schriftarten an IBM Plex Sans an

3. **Pfad-Struktur**
   - Neue UI-Komponenten: `/src/components/ui/[component-name].jsx`
   - Geschäftskomponenten: `/src/components/[feature]/[component-name].jsx`
   - Layout-Komponenten: `/src/components/layout/[component-name].jsx`

4. **Integration in React Admin**
   - Komponenten können in React Admin Resources verwendet werden
   - Verwende Tailwind-Klassen direkt in JSX
   - Für komplexe Layouts: Kombiniere React Admin Layout mit Tailwind-Komponenten

### Beispiel: Komponente integrieren

```jsx
// src/components/ui/dashboard-sidebar.jsx
"use client"
import React, { useState } from "react";
import { Home, DollarSign, Users } from "lucide-react";
import { cn } from "@/lib/utils"; // shadcn utility function

export const DashboardSidebar = () => {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("Dashboard");

  return (
    <nav
      className={cn(
        "sticky top-0 h-screen shrink-0 border-r transition-all duration-300",
        "bg-background-paper border-border",
        open ? "w-64" : "w-16"
      )}
    >
      {/* Sidebar content */}
    </nav>
  );
};
```

### Abhängigkeiten installieren

```bash
# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer

# shadcn/ui (wenn noch nicht installiert)
npx shadcn@latest init

# Icons (falls benötigt)
npm install lucide-react

# Utility-Funktionen (für shadcn)
npm install clsx tailwind-merge
```

### Implementierungs-Schritte

0. **Setup prüfen**
   - Tailwind CSS installiert und konfiguriert?
   - shadcn/ui initialisiert?
   - `components.json` vorhanden?

1. **Komponente kopieren**
   - Kopiere Komponente nach `/src/components/ui/[name].jsx`
   - Stelle sicher, dass alle Imports korrekt sind

2. **Theme anpassen**
   - Ersetze generische Farben mit DNA ME Theme-Farben
   - Teste Dark Mode Funktionalität
   - Passe Schriftarten an

3. **Abhängigkeiten installieren**
   - Installiere fehlende npm-Pakete
   - Prüfe ob shadcn/ui Komponenten benötigt werden

4. **Integration testen**
   - Teste Komponente in Isolation
   - Integriere in bestehende React Admin Resources
   - Prüfe Responsive-Verhalten

5. **Dokumentation**
   - Dokumentiere Props und Verwendung
   - Füge Beispiele hinzu

### Fragen zur Klärung

- Welche Daten/Props werden an die Komponente übergeben?
- Gibt es spezielle State-Management-Anforderungen?
- Werden Assets benötigt (Bilder, Icons)?
- Wie ist das erwartete Responsive-Verhalten?
- Wo soll die Komponente im React Admin verwendet werden?
- Soll die Komponente Material-UI komplett ersetzen oder parallel existieren?

### Migration von Material-UI zu Tailwind

Wenn bestehende Material-UI Komponenten migriert werden sollen:

1. **Schrittweise Migration**
   - Beginne mit neuen Komponenten (Tailwind)
   - Migriere bestehende Komponenten nach und nach
   - Behalte Material-UI für React Admin Core-Komponenten

2. **Wrapper-Komponenten**
   - Erstelle Wrapper für React Admin Komponenten
   - Verwende Tailwind für Custom-Komponenten

3. **Styling-Strategie**
   - Verwende Tailwind-Klassen für neue Komponenten
   - Behalte Material-UI `sx` Props für React Admin Overrides
   - Vermeide Style-Konflikte zwischen beiden Systemen
```

---

## Implementierungsplan

### Phase 1: Setup & Konfiguration

1. **Tailwind CSS installieren**
   ```bash
   cd frontend
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

2. **Tailwind Config anpassen**
   - Erstelle `tailwind.config.js` mit DNA ME Theme-Farben
   - Konfiguriere Dark Mode
   - Setze IBM Plex Sans als Standard-Schriftart

3. **PostCSS Config erstellen**
   - Erstelle `postcss.config.js`

4. **index.css aktualisieren**
   - Füge Tailwind-Direktiven hinzu
   - Behalte bestehende Custom-Styles

5. **shadcn/ui initialisieren**
   ```bash
   npx shadcn@latest init
   ```
   - Wähle JavaScript statt TypeScript
   - Setze Komponenten-Pfad auf `src/components/ui`
   - Wähle Tailwind als Styling-System

### Phase 2: Utility-Funktionen & Basis-Setup

1. **Utility-Funktionen installieren**
   ```bash
   npm install clsx tailwind-merge
   ```

2. **lib/utils.js erstellen**
   - Erstelle `cn()` Utility-Funktion für className-Merging

3. **Erste shadcn/ui Komponenten installieren**
   ```bash
   npx shadcn@latest add button
   npx shadcn@latest add card
   npx shadcn@latest add badge
   ```

### Phase 3: Theme-Anpassung

1. **Tailwind Theme erweitern**
   - Füge DNA ME Farben hinzu
   - Konfiguriere Dark Mode Varianten
   - Setze Border Radius und Spacing

2. **shadcn/ui Theme anpassen**
   - Passe `components.json` an
   - Aktualisiere CSS-Variablen für DNA ME Branding

### Phase 4: Komponenten-Migration

1. **Neue Komponenten mit Tailwind**
   - Beginne mit neuen Features
   - Verwende Tailwind für Custom-Komponenten

2. **Bestehende Komponenten migrieren**
   - Migriere `ScoreBadge` und `StatusBadge` zu Tailwind
   - Erstelle neue Versionen in `/components/ui`

3. **React Admin Integration**
   - Verwende Tailwind für Custom-Layouts
   - Behalte Material-UI für React Admin Core

### Phase 5: Dokumentation & Best Practices

1. **Style Guide erstellen**
   - Dokumentiere DNA ME Design-Tokens
   - Erstelle Komponenten-Beispiele

2. **Best Practices definieren**
   - Wann Tailwind verwenden?
   - Wann Material-UI verwenden?
   - Wie Komponenten strukturieren?

---

## Wichtige Hinweise

### Kompatibilität mit React Admin

- React Admin verwendet Material-UI intern
- Tailwind-Komponenten können parallel verwendet werden
- Vermeide Style-Konflikte durch Namespace-Isolation

### Dark Mode

- Das Projekt verwendet bereits Dark Mode
- Tailwind Dark Mode sollte mit bestehendem System kompatibel sein
- Verwende `dark:` Varianten für Dark Mode Styles

### Performance

- Tailwind CSS wird zur Build-Zeit optimiert
- Unused Styles werden automatisch entfernt
- Prüfe Bundle-Größe nach Integration

### Migration-Strategie

- **Inkrementell**: Migriere Komponenten nach und nach
- **Parallel**: Beide Systeme können koexistieren
- **Selektiv**: Verwende Tailwind für neue Features, Material-UI für React Admin Core
