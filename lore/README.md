# Lore

The source of truth for every one-shot. Everything the one-shots build on is written here first; one-shots link to it by entry id.

```
lore/
├── data/                 # The truth (human-readable YAML; the schema is at the top of each file)
│   ├── overview.yaml     # Title, intro, at-a-glance facts, free sections (also feeds the landing page)
│   ├── map.yaml          # The cavity map: substructure positions, walls, tram lines, roads
│   ├── substructures/    # _superstructure.yaml (the Superstructure as a whole), then one file per substructure
│   ├── timeline.yaml     # Eras → events
│   ├── orbit.yaml        # Order of the peripheries in the orbit
│   ├── peripheries/      # _peripheries.yaml (peripheries in general), 00-baseline.yaml, then one file per Greek letter, numbered in alphabet order (01-alpha.yaml … 24-omega.yaml)
│   ├── entities.yaml     # Creatures and anomalies
│   └── objects.yaml      # Artifacts, technology, substances, items
└── webapp/               # Display only, reads ../data/
    ├── index.html        # Start page: the cavity map, then the overview
    ├── substructure.html # One substructure: substructure.html?id=sb17
    ├── peripheries.html  # The periphery orbit
    ├── periphery.html    # One periphery: periphery.html?id=delta
    ├── codex.html        # The other collections: codex.html?c=entities, ?c=objects
    └── timeline.html
```

## Rules

- **A new substructure file must be listed in `map.yaml`, a new periphery file in `orbit.yaml`** (static hosting cannot list folders).
- **`show: false`** (peripheries) hides an entry everywhere on the site.
- **Fan-made mode** (the four-strip button, bottom right): `canon: ours` entries and timeline events only exist in fan mode. A `fan:` block in any lore file adds to it in fan mode: its `sections` are appended (shown red), other fields replace the normal ones.
- **"No known information"**: a substructure or periphery without `summary`, `details`, `related` or `sources` is shown dimmed, unless it is `marked`.

- **Ids are global.** An `id` must be unique across all lore files, because `related`, `periphery` and `origin` may point into any of them.
- **Every entry and event says how sure we are** with `canon`:

| canon | Meaning |
|-------|---------|
| `confirmed` | Shown in the game itself: notes, terminals, announcements, locations |
| `developer` | Stated by the developers outside the game |
| `theory` | Community reading, not confirmed |
| `ours` | Fan-made: our own addition or change for the one-shots, not part of the game (shown with the four-strip fan mark) |

- **Write where it came from** in `sources`, one line each.
- Missing ids show up on the pages as dashed tags, so links to entries we have not written yet are easy to spot.
