# Prompt: Aus beliebiger Tabelle ein CRM-CSV erstellen

Kopiere den folgenden Block und füge darunter deine Tabelle oder deine Daten ein. Eine KI (z. B. Cursor, ChatGPT, Claude) kann daraus eine gültige CSV im richtigen Format erzeugen.

---

## Prompt (zum Kopieren)

```
Ich habe eine Tabelle oder eine Liste mit Kontakten / Leads. Bitte wandle sie in eine CSV-Datei um, die unser CRM-Import versteht.

**Zielformat:**
- Erste Zeile = Header (Spaltennamen genau wie unten).
- Trennzeichen: Komma (,) oder Semikolon (;) – einheitlich in der ganzen Datei.
- Encoding: UTF-8.
- Texte mit Komma/Anführungszeichen in doppelte Anführungszeichen setzen (z. B. "Muster, GmbH").

**Spalten (Header) – nutze exakt diese Namen:**

Pflicht (mindestens eine Spalte muss vorhanden sein):
- email          → E-Mail-Adresse (pro Zeile eindeutig)

Optional – Kontakt:
- first_name     → Vorname
- last_name      → Nachname
- phone          → Telefon
- job_title      → Position / Berufsbezeichnung
- linkedin_url   → LinkedIn-Profil-URL
- message        → Freitext; wird als Notiz im Chat importiert (optional)

Optional – Firma:
- company_name   → Firmenname
- company_domain → Domain / Website (z. B. example.com)
- industry       → Branche
- company_size   → Firmengröße (z. B. 1-10, 11-50)
- country        → Ländercode 2 Buchstaben (z. B. DE, AT, CH)

**Regeln:**
- Jede Zeile = ein Kontakt (Lead). Fehlende Werte leer lassen.
- E-Mail muss pro Zeile gesetzt und gültig sein (z. B. name@domain.de).
- Wenn du Spalten aus meiner Tabelle nicht zuordnen kannst, weglassen oder die passende CRM-Spalte leer lassen.
- Wenn in meiner Tabelle mehrere E-Mails oder mehrere „Nachrichten“-Spalten vorkommen: eine sinnvolle Auswahl treffen oder kombinieren (z. B. eine Nachricht pro Zeile).

Gib mir am Ende nur die CSV aus (mit Header), sodass ich sie kopieren und als .csv speichern kann.
```

**Meine Tabelle / meine Daten:**

[HIER DEINE TABELLE EINFÜGEN – z. B. aus Excel kopiert, als Text, oder als Markdown-Tabelle]

```

---

## Kurzversion (wenn du nur schnell die Spalten nennen willst)

```
Wandle die folgende Tabelle in CSV um.
Header (erste Zeile) sollen exakt so heißen: email (Pflicht), first_name, last_name, phone, job_title, linkedin_url, message, company_name, company_domain, industry, company_size, country.
Trennzeichen: Komma. UTF-8. Fehlende Werte leer. Texte mit Komma in Anführungszeichen.

[Daten einfügen]
```

---

## Beispiel-Output (so sollte eine Zeile aussehen)

```csv
email,first_name,last_name,phone,job_title,linkedin_url,message,company_name,company_domain,industry,company_size,country
max@example.com,Max,Mustermann,+49 123 456789,Geschäftsführer,,Kunde hat am 12.1. angefragt,Muster GmbH,muster.de,B2B Software,11-50,DE
```

Die erste Zeile ist der Header; danach eine Zeile pro Kontakt. Spalten ohne Wert können leer sein (z. B. `,,,`).
