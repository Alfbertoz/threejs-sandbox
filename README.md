# Three.js Sandbox

A personal workshop for three.js experiments. Each experiment lives in its own folder under `/experiments/` and is completely independent — break one, the others keep working.

---

## Running it locally (Windows 10)

You'll need **Node.js 18+** installed. If you haven't got it: https://nodejs.org (pick the LTS version).

Open a terminal in this folder (Shift + Right-click inside the folder → "Open PowerShell window here") and run:

```powershell
npm install
npm run dev
```

Your browser should open to `http://localhost:5173` automatically.

Any edits to files will hot-reload in the browser instantly.

---

## Adding a new experiment

1. Copy the `experiments/01-floating-monolith` folder.
2. Rename the copy (e.g. `02-shader-playground`).
3. Edit `main.js` to your heart's content.
4. Open `index.html` at the project root and add a new `<li>` block in the experiment list pointing to your new folder.

That's it. Vite auto-discovers any new folder with an `index.html` inside `/experiments/`.

---

## Deploying to Azure Static Web Apps

This project is set up to deploy automatically via GitHub Actions. Once connected to Azure:

- Every `git push` to your `main` branch triggers a build.
- Azure builds the site with `npm run build` and serves the contents of `/dist/`.
- You'll get a free `*.azurestaticapps.net` URL with HTTPS.

The `staticwebapp.config.json` file handles URL routing so direct links to experiments work.

---

## Project structure

```
threejs-sandbox/
├── index.html                     ← landing page (lists all experiments)
├── src/styles/main.css            ← landing page styles
├── experiments/
│   └── 01-floating-monolith/
│       ├── index.html
│       └── main.js
├── vite.config.js                 ← auto-discovers experiments
├── staticwebapp.config.json       ← Azure routing rules
└── package.json
```
