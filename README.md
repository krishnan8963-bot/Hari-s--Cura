# Hari's Cura — Smart Personal Planner

A calm, premium personal to-do and life planner. Plan your day, track your
progress across day/week/month/year views, manage a shopping list, and see
real statistics — all fully offline, with **your data staying on your
device**. No account, no backend, no tracking.

---

## 1. File structure

```text
HarisCura/
│
├── index.html          Markup for every screen, modal, and sheet
├── style.css            Full design system (light + dark themes)
├── app.js                All application logic (state, rendering, events)
├── db.js                  IndexedDB persistence layer
├── notifications.js  Browser Notifications wrapper
├── manifest.json      Web App Manifest (installability)
├── service-worker.js  Offline app-shell caching
│
├── icons/
│   ├── icon-64.png              (browser tab favicon)
│   ├── icon-192.png             (standard app icon)
│   ├── icon-512.png             (standard app icon, large)
│   └── icon-512-maskable.png    (Android adaptive-icon safe zone)
│
└── README.md
```

Everything is vanilla HTML/CSS/JS — no build step, no framework, no npm
install required to run it.

---

## 2. Run it locally

Browsers block IndexedDB, Service Workers, and the Manifest from working
correctly when a page is opened directly via `file://`, so serve the folder
over a local HTTP server:

```bash
cd HarisCura
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Or, with Node installed:

```bash
npx serve HarisCura
```

Or with VS Code: install the "Live Server" extension and click **Go Live**.

---

## 3. Deploy to GitHub Pages

1. Push the contents of the `HarisCura/` folder to a GitHub repository
   (the files can live at the repo root, or in a `/docs` folder).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch",
   pick your branch, and the folder (`/root` or `/docs`).
4. Save. GitHub will publish at `https://<username>.github.io/<repo>/`.
5. Because `manifest.json`'s `start_url` and `scope` are relative (`./`),
   and the service worker registers with `./service-worker.js`, this works
   correctly even when the site is served from a sub-path.

---

## 4. Deploy to Netlify

**Option A — drag and drop:**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the `HarisCura` folder onto the page.
3. Netlify publishes it instantly at a generated URL.

**Option B — CLI:**
```bash
npm install -g netlify-cli
cd HarisCura
netlify deploy --prod
```

No build command or publish-directory configuration is needed beyond
pointing Netlify at this folder — there's nothing to compile.

---

## 5. Install as an Android PWA

1. Open the deployed site in **Chrome for Android**.
2. Use it for a few seconds (Chrome's install heuristics need some
   engagement first), or simply wait — Hari's Cura also shows its own
   **"Install Hari's Cura"** banner once the browser tells it installation
   is available.
3. Tap **Install** on the in-app banner, or open Chrome's **⋮ menu → Install
   app**.
4. The app icon appears on the home screen and opens in standalone mode
   (no browser address bar).

On **iPhone/iPad (Safari)**: Safari doesn't fire the same install prompt.
Instead: tap the **Share** icon → **Add to Home Screen**. The app will still
launch full-screen from the home screen icon.

On **desktop Chrome/Edge**: an install icon appears in the address bar, or
use the in-app **Install** banner.

---

## 6. How automatic carry-forward works

- Every time the app loads, it checks every **incomplete** task whose
  `date` is earlier than today.
- If the global setting **Automatic Carry Forward** is on, *and* the
  individual task's **"Carry forward if incomplete"** option is on, the
  task's `date` is updated to today.
- The task's original date is preserved in `originalDate` the first time
  this happens (it isn't overwritten on subsequent carries), and
  `carriedForward` is set to `true` so the UI can show the **"Carried
  forward"** badge.
- This is a genuine **move**, not a copy — the same task record (`id`)
  moves forward, so it's never duplicated.
- Completed tasks are never touched.
- Manually moving a task (via **Move to date** or drag-and-drop in the
  Planner) clears the "carried forward" badge, since you've now taken
  direct control of its schedule.
- Recurring tasks are separate: when a recurring task is **completed**, a
  new task record is created for the next occurrence. The completed
  occurrence is left alone (so your statistics stay historically accurate).

---

## 7. How reminders work — and their real limitations

Hari's Cura uses the browser's **Notifications API**. Read this carefully
before relying on it for anything time-critical:

- When you turn on **Notifications** in Settings, the app asks your browser
  for permission, then schedules an in-page timer (`setTimeout`) for any
  task with a reminder set, timed to fire at "task time minus your chosen
  lead time."
- **This only works while the app (tab or installed window) is actually
  open and running.** There is no background push here — that would
  require a server, the Push API, and a hosted push service, which is
  intentionally out of scope for this offline-first, backend-free version.
- Reminders are only scheduled if they land within the next 24 hours, since
  browsers can silently drop or fire early on very long `setTimeout` delays.
- **iOS Safari** has minimal support for web notifications even for
  installed home-screen apps — do not rely on reminders there.
- **Desktop Chrome/Edge** with the app installed tend to be the most
  reliable, since the browser process can keep the app running in the
  background more consistently.
- The notification code is structured (see `notifications.js`) so that a
  future backend could plug in real Push API subscriptions without
  changing how tasks store their reminder preferences.

---

## 8. Browser limitations to be aware of

- **No background sync** — reminders and carry-forward both only run while
  the app is open (carry-forward also re-checks every time you reopen it).
- **No cross-device sync** — IndexedDB is local to the browser/device.
  Use **Export/Backup** and **Import/Restore** in *More → Data* to move
  data between devices manually.
- **iOS Safari** notification support is minimal, as noted above.
- **Private/Incognito windows** may restrict or auto-clear IndexedDB and
  service worker storage.
- **Very long `setTimeout` delays** (>24h) aren't used for scheduling,
  since browsers don't guarantee firing them accurately.
- Clearing site data/cache in the browser will delete all local tasks and
  settings — regular backups are the only protection against this in v1.

---

## 9. Future features that would require a backend

- **Cross-device sync** — keeping tasks consistent across your phone,
  tablet, and desktop in real time.
- **True background push notifications** — reminders that fire even when
  the app isn't open, via the Push API + a push service + a server to
  trigger sends.
- **Shared/collaborative lists** — e.g. a shared household shopping list.
- **Account recovery** — restoring data after a lost/reset device without
  a manual backup file.
- **Calendar integration** (Google Calendar, Apple Calendar two-way sync).
- **Server-side analytics** for longer-term trend insights across devices.

---

## 10. Privacy

Hari's Cura stores everything locally in your browser's IndexedDB. It does
not send task data anywhere, and it includes no analytics or tracking of
any kind. This is stated directly in the app under **More → Privacy**.
