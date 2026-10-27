# Return to the Superstructure

Pen & paper one-shots set in the world of **White Knuckle**. The lore is the source of truth; every one-shot builds on it and links back into it.

Live site: GitHub Pages (deployed from `main` by [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

## Structure

```
├── index.html            # Landing page: the lore first, then the one-shots
├── lore/                 # The source of truth  → lore/README.md
│   ├── data/             #   YAML
│   └── webapp/           #   pages that display it
├── one-shots/
│   ├── catalog.yaml      # Which one-shots the landing page lists, in order
│   ├── _template/        # Copy this to start a one-shot → one-shots/_template/README.md
│   └── <one-shot>/
│       ├── data/         #   YAML
│       └── webapp/       #   pages that display it
└── shared/               # Styles, background tile and core JS used by every page
    ├── css/style.css, css/dither.png
    ├── js/core.js
    └── tools/make-dither.js   # Regenerates the dithered background tile
```

Every page is static HTML. The YAML is loaded in the browser (js-yaml and marked from cdnjs), so there is no build step.

## Run locally

The pages fetch their YAML, so they need a local server (opening the files directly does not work):

```
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## GitHub Pages

In the repository settings, set **Pages → Source** to **GitHub Actions**. Every push to `main` deploys the site.

## Background

The grey pixel texture is a seamless ordered-dither tile. To change it, edit the values at the top of `shared/tools/make-dither.js` and run `node shared/tools/make-dither.js`.

## License

Fan project for personal use. White Knuckle and its world belong to its developers.
