# One-Shot Template

Copy this folder to start a new one-shot:

1. Copy `one-shots/_template/` to `one-shots/<your-folder>/` (kebab-case, no spaces).
2. Fill in `data/overview.yaml` and the other YAML files.
3. Add `<your-folder>` to `one_shots:` in [one-shots/catalog.yaml](../catalog.yaml) so it shows on the landing page.

```
<your-folder>/
├── README.md
├── data/                 # Source of truth for this one-shot (human-readable YAML)
│   ├── overview.yaml     # Title, card details, lore references, GM text
│   ├── locations.yaml
│   ├── characters.yaml
│   ├── timeline.yaml     # Session flow
│   └── audio.yaml
└── webapp/               # Display only, reads ../data/
    ├── index.html, locations.html, characters.html, timeline.html, audio.html
    └── js/app.js
```

Link to the lore with entry ids from `lore/data/` (`lore_refs`, `lore_ref`, `denizens`). Ids that do not exist yet show up as dashed tags, so you can see what still needs writing in the lore.
