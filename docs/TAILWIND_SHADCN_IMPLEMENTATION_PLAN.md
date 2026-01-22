# DNA ME CRM - Tailwind CSS & shadcn/ui Implementierungsplan

## Übersicht

Dieser Plan beschreibt die schrittweise Integration von Tailwind CSS und shadcn/ui in das DNA ME CRM-Projekt, während die bestehende React Admin-Architektur erhalten bleibt.

---

## Phase 1: Tailwind CSS Setup

### Schritt 1.1: Dependencies installieren

```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer
```

### Schritt 1.2: Tailwind Config erstellen

Erstelle `frontend/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DNA ME Brand Colors
        background: {
          DEFAULT: '#0a0a0f',
          paper: '#12121a',
        },
        foreground: {
          DEFAULT: '#e0e0e0',
          muted: '#a0a0a0',
        },
        primary: {
          DEFAULT: '#4A90A4',
          foreground: '#ffffff',
          hover: '#6AAFC2',
        },
        accent: {
          DEFAULT: '#6AAFC2',
          foreground: '#ffffff',
        },
        border: {
          DEFAULT: '#2a2a3a',
          hover: '#3a3a4a',
        },
        muted: {
          DEFAULT: '#1a1a24',
          foreground: '#a0a0a0',
        },
        // Material-UI kompatible Farben für React Admin
        divider: '#2a2a3a',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        'sm': '0 2px 4px rgba(0,0,0,0.2)',
        'DEFAULT': '0 4px 8px rgba(0,0,0,0.25)',
        'md': '0 6px 12px rgba(0,0,0,0.3)',
        'lg': '0 8px 16px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}
```

### Schritt 1.3: PostCSS Config erstellen

Erstelle `frontend/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### Schritt 1.4: index.css aktualisieren

Aktualisiere `frontend/src/index.css`:

```css
/**
 * DNA ME CRM Global Styles
 * Tailwind CSS Integration
 */

/* Tailwind Directives */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Import IBM Plex Sans from Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

/* Base Layer - Tailwind Base Styles */
@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-foreground;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    min-height: 100vh;
  }

  #root {
    min-height: 100vh;
  }
}

/* Components Layer - Custom Component Styles */
@layer components {
  /* Scrollbar Styles */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    @apply bg-background;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    @apply bg-border rounded;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    @apply bg-border-hover;
  }

  /* Selection */
  ::selection {
    @apply bg-primary/30 text-white;
  }

  /* Focus outline */
  :focus-visible {
    @apply outline-2 outline-primary outline-offset-2;
  }

  /* Links */
  a {
    @apply text-primary no-underline;
  }

  a:hover {
    @apply text-primary-hover;
  }
}

/* Utilities Layer - Custom Utility Classes */
@layer utilities {
  .fade-in {
    animation: fadeIn 0.3s ease-in-out;
  }

  .slide-in {
    animation: slideIn 0.3s ease-out;
  }
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* React Admin Overrides - Behalten für Kompatibilität */
.RaLayout-content {
  background-color: #0a0a0f !important;
}

.RaSidebar-fixed {
  background-color: #12121a !important;
}
```

---

## Phase 2: shadcn/ui Setup

### Schritt 2.1: shadcn/ui initialisieren

```bash
cd frontend
npx shadcn@latest init
```

**Konfiguration:**
- Style: Default
- Base Color: Slate
- CSS Variables: Yes
- JavaScript/TypeScript: JavaScript
- Component Path: `src/components/ui`
- Utils Path: `src/lib/utils`

### Schritt 2.2: Utility-Funktionen erstellen

Erstelle `frontend/src/lib/utils.js`:

```js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 * Kombiniert clsx und tailwind-merge für optimale className-Verwaltung
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

### Schritt 2.3: Dependencies installieren

```bash
npm install clsx tailwind-merge
npm install lucide-react  # Für Icons
```

### Schritt 2.4: components.json anpassen

Aktualisiere `frontend/components.json` für DNA ME Theme:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### Schritt 2.5: Vite Config für Path-Aliases aktualisieren

Aktualisiere `frontend/vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## Phase 3: Erste Komponenten installieren

### Schritt 3.1: Basis-Komponenten hinzufügen

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add badge
npx shadcn@latest add avatar
npx shadcn@latest add separator
```

### Schritt 3.2: Theme-Variablen anpassen

Aktualisiere CSS-Variablen in `frontend/src/index.css`:

```css
@layer base {
  :root {
    --background: 10 10 15;        /* #0a0a0f */
    --foreground: 224 224 224;      /* #e0e0e0 */
    --card: 18 18 26;               /* #12121a */
    --card-foreground: 224 224 224;
    --popover: 18 18 26;
    --popover-foreground: 224 224 224;
    --primary: 74 144 164;          /* #4A90A4 */
    --primary-foreground: 255 255 255;
    --secondary: 26 26 36;          /* #1a1a24 */
    --secondary-foreground: 224 224 224;
    --muted: 26 26 36;
    --muted-foreground: 160 160 160;
    --accent: 106 175 194;          /* #6AAFC2 */
    --accent-foreground: 255 255 255;
    --destructive: 239 68 68;
    --destructive-foreground: 255 255 255;
    --border: 42 42 58;             /* #2a2a3a */
    --input: 42 42 58;
    --ring: 74 144 164;             /* #4A90A4 */
    --radius: 8px;
  }
}
```

---

## Phase 4: Beispiel-Komponente migrieren

### Schritt 4.1: ScoreBadge mit Tailwind neu schreiben

Erstelle `frontend/src/components/ui/score-badge.jsx`:

```jsx
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * ScoreBadge - DNA ME CRM Score Badge mit Tailwind CSS
 * Ersetzt die Material-UI Version
 */
export const ScoreBadge = ({ score, className }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return "bg-green-500/20 text-green-400 border-green-500/50";
    if (score >= 60) return "bg-blue-500/20 text-blue-400 border-blue-500/50";
    if (score >= 40) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    return "bg-red-500/20 text-red-400 border-red-500/50";
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold border",
        getScoreColor(score),
        className
      )}
    >
      {score}
    </Badge>
  );
};
```

### Schritt 4.2: StatusBadge mit Tailwind neu schreiben

Erstelle `frontend/src/components/ui/status-badge.jsx`:

```jsx
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * StatusBadge - DNA ME CRM Status Badge mit Tailwind CSS
 */
export const StatusBadge = ({ status, className }) => {
  const statusConfig = {
    new: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    qualified: "bg-green-500/20 text-green-400 border-green-500/50",
    lost: "bg-red-500/20 text-red-400 border-red-500/50",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border capitalize",
        statusConfig[status] || "bg-muted text-muted-foreground",
        className
      )}
    >
      {status}
    </Badge>
  );
};
```

---

## Phase 5: Integration in React Admin

### Schritt 5.1: Wrapper-Komponente erstellen

Erstelle `frontend/src/components/ui/react-admin-wrapper.jsx`:

```jsx
/**
 * React Admin Wrapper
 * Ermöglicht die Verwendung von Tailwind-Komponenten in React Admin
 */
export const ReactAdminWrapper = ({ children, className }) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};
```

### Schritt 5.2: Beispiel: LeadList mit Tailwind-Komponenten

```jsx
import { List, Datagrid, TextField } from 'react-admin';
import { Card, CardContent } from '@/components/ui/card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { StatusBadge } from '@/components/ui/status-badge';

export const LeadList = (props) => {
  return (
    <List {...props}>
      <Card className="m-4">
        <CardContent>
          <Datagrid>
            <TextField source="name" />
            <TextField source="email" />
            <ScoreBadge source="score" />
            <StatusBadge source="status" />
          </Datagrid>
        </CardContent>
      </Card>
    </List>
  );
};
```

---

## Phase 6: Testing & Validierung

### Schritt 6.1: Build testen

```bash
npm run build
```

### Schritt 6.2: Development Server starten

```bash
npm run dev
```

### Schritt 6.3: Prüfungen

- [ ] Tailwind-Klassen werden korrekt angewendet
- [ ] Dark Mode funktioniert
- [ ] shadcn/ui Komponenten rendern korrekt
- [ ] React Admin funktioniert weiterhin
- [ ] Keine Style-Konflikte zwischen Tailwind und Material-UI
- [ ] Bundle-Größe ist akzeptabel

---

## Phase 7: Dokumentation

### Schritt 7.1: Style Guide erstellen

Erstelle `docs/STYLE_GUIDE.md` mit:
- DNA ME Design-Tokens
- Verwendung von Tailwind-Klassen
- Komponenten-Beispiele
- Best Practices

### Schritt 7.2: Migration Guide erstellen

Erstelle `docs/MIGRATION_GUIDE.md` mit:
- Wie man Material-UI zu Tailwind migriert
- Wann welches System verwendet werden soll
- Häufige Patterns

---

## Checkliste

### Setup
- [ ] Tailwind CSS installiert
- [ ] PostCSS konfiguriert
- [ ] tailwind.config.js erstellt
- [ ] index.css aktualisiert
- [ ] shadcn/ui initialisiert
- [ ] components.json konfiguriert
- [ ] lib/utils.js erstellt
- [ ] Vite Aliases konfiguriert

### Komponenten
- [ ] Basis-Komponenten installiert (Button, Card, Badge)
- [ ] ScoreBadge migriert
- [ ] StatusBadge migriert
- [ ] Theme-Variablen angepasst

### Integration
- [ ] React Admin Wrapper erstellt
- [ ] Beispiel-Komponente integriert
- [ ] Build erfolgreich
- [ ] Development Server läuft

### Dokumentation
- [ ] Style Guide erstellt
- [ ] Migration Guide erstellt
- [ ] README aktualisiert

---

## Nächste Schritte

Nach erfolgreicher Integration:

1. **Weitere Komponenten migrieren**
   - Dashboard-Komponenten
   - Form-Komponenten
   - Layout-Komponenten

2. **Design System erweitern**
   - Weitere shadcn/ui Komponenten hinzufügen
   - Custom-Komponenten erstellen
   - Animationen hinzufügen

3. **Performance optimieren**
   - Bundle-Größe analysieren
   - Unused Styles entfernen
   - Code Splitting optimieren
