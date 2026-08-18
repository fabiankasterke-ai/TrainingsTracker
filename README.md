# TrainingsTracker 🏋️

Eine kostenlose, installierbare Web-App (PWA) für dein Handy, mit der du deine eigenen Trainingspläne verwaltest und bei jedem Training Gewicht & Wiederholungen einträgst. Mehrere Personen können sich einloggen – jede:r sieht ausschließlich die eigenen Pläne und Werte.

**Struktur:** Trainingsplan → Trainingsblöcke (Mesozyklen, z. B. "Block 1 – Kraftaufbau") → Trainingstage (1–7 pro Block) → Abschnitte (z. B. Warm-up, Hauptteil) mit Übungen. Beim Training wird dir automatisch der letzte Wert je Übung/Satz angezeigt, damit du leicht progressiv steigern kannst.

**Tech-Stack:** reines HTML/CSS/JavaScript (kein Build-Prozess nötig) + [Supabase](https://supabase.com) für Login und Datenbank. Beides ist für eine private App mit wenigen Nutzer:innen dauerhaft kostenlos.

---

## 1. Supabase-Projekt einrichten (5 Minuten, kostenlos)

1. Gehe zu [supabase.com](https://supabase.com) und erstelle einen kostenlosen Account.
2. Klicke auf **"New Project"**, gib einen Namen ein (z. B. `trainingstracker`) und ein Datenbank-Passwort (merken oder speichern, wird selten gebraucht).
3. Warte, bis das Projekt bereit ist (ca. 1–2 Minuten).
4. Öffne links **SQL Editor → New query**, füge den kompletten Inhalt der Datei `supabase/schema.sql` ein und klicke **Run**. Das legt alle Tabellen (Pläne, Blöcke, Trainingstage, Übungen, Logs) inkl. Sicherheitsregeln (Row Level Security) an, sodass jede:r Nutzer:in nur die eigenen Daten sieht.
5. Gehe zu **Project Settings → API**. Kopiere dir:
   - **Project URL**.  https://fvmjaxpryfqqjcmuytpw.supabase.co/rest/v1/
   - **anon public key** sb_publishable_ZzMzSFlcFdGTaz7bFBUOkA_Emm1BdPa

## 2. App konfigurieren

Öffne `js/config.js` und trage die beiden Werte aus Schritt 1 ein:

```js
export const SUPABASE_URL = "https://dein-projekt.supabase.co";
export const SUPABASE_ANON_KEY = "dein-anon-key";
```

Speichern – das war's, die App ist jetzt einsatzbereit.

### Wichtig: E-Mail-Bestätigung beim Testen

Standardmäßig verlangt Supabase, dass neue Accounts ihre E-Mail bestätigen, bevor sie sich einloggen können. Für eine private App mit wenigen Nutzer:innen kannst du das abschalten:
**Authentication → Providers → Email → "Confirm email"** deaktivieren. Dann kann man sich direkt nach der Registrierung einloggen.

## 3. Kostenlos online stellen (Deployment)

Am einfachsten mit **Vercel** oder **Netlify** (beide haben einen dauerhaft kostenlosen Plan für private Projekte):

### Variante A – Netlify (Drag & Drop, kein Account bei GitHub nötig)
1. Gehe zu [app.netlify.com/drop](https://app.netlify.com/drop)
2. Ziehe den kompletten `trainingstracker`-Ordner in das Browserfenster
3. Fertig – du bekommst eine URL wie `https://dein-name.netlify.app`, die du auf dem Handy öffnen kannst

### Variante B – Vercel (empfohlen für spätere Updates)
1. Lade den Ordner z. B. in ein GitHub-Repository hoch
2. Auf [vercel.com](https://vercel.com) → "Add New Project" → Repository auswählen → Deploy
3. Kein Build-Schritt nötig (Framework: "Other" / statisch)

## 4. Auf dem Handy installieren

1. Öffne die App-URL im Handy-Browser (Safari bei iPhone, Chrome bei Android)
2. **iPhone:** Teilen-Symbol → "Zum Home-Bildschirm"
3. **Android:** Menü (⋮) → "App installieren" bzw. "Zum Startbildschirm hinzufügen"

Danach verhält sich die App wie eine echte App mit eigenem Icon, ganz ohne Adressleiste.

---

## Bedienung

- **Registrieren/Anmelden** – jede Person legt ihren eigenen Account an.
- **Trainingsplan anlegen** → **Trainingsblock hinzufügen** (z. B. "Block 1 – Kraftaufbau") → **Trainingstag hinzufügen** (max. 7 pro Block, z. B. "Tag 1 – Push").
- Über **"✎ Übungen bearbeiten"** bei einem Trainingstag fügst du Übungen hinzu: Abschnitt (z. B. Warm-up/Hauptteil), Name, Zielsätze, Zielwiederholungen, optionale Notizen.
- Zum Trainieren einfach auf den Trainingstag tippen: pro Satz siehst du den letzten Wert und trägst Gewicht/Wiederholungen ein. Mit **"+ Satz"** kannst du spontan einen zusätzlichen Satz ergänzen. **"💾 Training speichern"** sichert alles – beim nächsten Training wird dir genau dieser Wert wieder als Referenz angezeigt.
- Über die kleinen ▲▼-Pfeile lassen sich Pläne, Blöcke und Trainingstage neu sortieren.

## Kosten

Bei privater Nutzung mit wenigen Accounts bleibt alles im kostenlosen Bereich:
- **Supabase Free Tier:** 500 MB Datenbank, 50.000 aktive Nutzer:innen/Monat – für diese App komplett ausreichend.
- **Netlify/Vercel Free Tier:** kostenloses Hosting für private/nicht-kommerzielle statische Seiten.

Kosten entstehen erst bei sehr viel größerem Umfang (tausende aktive Nutzer, sehr viel Traffic), was für eine persönliche Trainings-App nicht relevant ist.

## Mögliche Erweiterungen für später

- Verlaufsdiagramm/Chart pro Übung (aktuell wird bewusst nur der letzte Wert angezeigt)
- Drag & Drop statt ▲▼-Pfeilen zum Umsortieren
- Ruhephasen-Timer zwischen den Sätzen
- Trainingsdauer/Kalorien tracken
- Export der Daten als CSV

## Projektstruktur

```
trainingstracker/
├── index.html              Einstiegspunkt der App
├── manifest.json            PWA-Manifest (Icon, Name, Farben)
├── service-worker.js        Cached die App-Hülle fürs schnelle/offline Starten
├── css/style.css            Gesamtes Styling (mobile-first, dunkles Theme)
├── icons/                   App-Icons
├── js/
│   ├── config.js             ← hier Supabase-Zugangsdaten eintragen
│   ├── supabaseClient.js     Supabase-Client-Setup
│   ├── ui.js                 Wiederverwendbare UI-Hilfsfunktionen
│   ├── auth.js                Login/Registrierung
│   ├── plan.js                Pläne, Blöcke, Trainingstage, Übungen (CRUD)
│   ├── workout.js             Trainings-Log-Ansicht (Gewicht/Wiederholungen)
│   └── app.js                 App-Einstiegspunkt & Navigation
└── supabase/schema.sql      Datenbankschema zum Ausführen im Supabase SQL Editor
```
