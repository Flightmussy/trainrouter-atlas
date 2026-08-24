# World Train Map Atlas — the world's legendary train routes, as open data

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21322030.svg)](https://doi.org/10.5281/zenodo.21322030)

**961 train routes · 118 countries · ≈ 432,800 km of route**, every route with its key facts and its geometry, from [worldtrainmap.com](https://worldtrainmap.com), the interactive world railway map.

High-speed spines (Eurostar, TGV, Shinkansen, AVE), classic long-distance runs (Trans-Siberian, California Zephyr), night trains (Nightjet, the Ghan) and the scenic lines people fly in just to ride (Glacier Express, Bernina Express, the Jacobite).

🗺️ **Explore it interactively:** [worldtrainmap.com](https://worldtrainmap.com)
🤖 **Use it from an AI assistant:** free MCP server at `https://worldtrainmap.com/mcp` ([how to connect](https://worldtrainmap.com/mcp-server/)), or run it from this repo: `npm install && npm start` ([`mcp/`](mcp/))

> **The site was renamed.** It was TrainRouter at `trainrouter.com` until 11 August 2026 and is now World Train Map at `worldtrainmap.com`. The old domain redirects path for path, so old links still work, and `https://trainrouter.com/mcp` still answers directly rather than redirecting, because JSON-RPC clients do not follow redirects. Nothing you already had configured has broken. The repository, the Zenodo DOI and the MCP registry name (`com.trainrouter/atlas`) keep their old identifiers on purpose: renaming them would break more than it would tidy.

## Which version holds what

Several different route counts are in circulation for this atlas, so here is the honest map of them.

| Where | Routes | Cut | Note |
|---|---|---|---|
| The live site | 1,338 | today | [worldtrainmap.com](https://worldtrainmap.com), always the newest |
| The MCP server | 1,247 | 11 August 2026 | deployed separately from the site, so it lags it a little |
| `data/` in this repo | 961 | 23 July 2026 | what you get by cloning or downloading here |
| Zenodo (the citable DOI) and Hugging Face | 744 | 12 July 2026 | release v1.1.0, the last tagged one |

**Why the download is behind the site, and it is deliberate.** Since late July the route geometry has been progressively re-traced from OpenStreetMap railway relations, which makes it a derivative of OSM data under ODbL, while this package is licensed CC BY 4.0 throughout. Publishing a refresh before the licence is split per route would ship a licence violation with our name on it, so the exporter is blocked until that work lands. See *Sources, accuracy & provenance* below. If you want something fresher than the July cut without waiting, the MCP server is the closest available.

## Files

| File | Contents |
|---|---|
| `data/routes.csv` | One row per route, all facts, no geometry |
| `data/routes.json` | Same records with structured country objects |
| `data/routes.geojson` | `LineString` per route (lon/lat waypoints) plus all facts as properties |

## Schema

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, e.g. `glacier-express` |
| `name` | string | Route/service name |
| `from`, `to` | string | Terminus cities |
| `category` | enum | In this cut: `high-speed` · `classic` · `night` · `scenic` · `luxury`. The live atlas adds `mountain` and `heritage` |
| `train` | string | Rolling stock, e.g. `e320 · Class 374` |
| `operator` | string | Operating company |
| `distance_km` | number | Route length |
| `top_speed_kmh` | number | Service top speed |
| `duration` | string | Published journey time, e.g. `2 h 16 min` |
| `opened` | number | Year the line/service entered service |
| `pax_per_year` | number\|null | Approx. annual ridership where published, which is rare: 80 of the 961 rows carry one |
| `countries_iso` / `countries` | string | `\|`-separated, in travel order (CSV); structured objects in JSON |
| `highlight` | string | One-line description of what makes the route legendary |
| `fame_rank` | number | 1 = most famous (the atlas's own renown ranking) |
| `url` | string | The route's page. These were written before the rename and still read `trainrouter.com`, which redirects to the same path on `worldtrainmap.com`; they will be rewritten in the next release |

## Quick start

```python
import pandas as pd
routes = pd.read_csv("data/routes.csv")
routes.nsmallest(10, "fame_rank")[["name", "from", "to", "distance_km"]]

import geopandas as gpd
gdf = gpd.read_file("data/routes.geojson")
gdf.plot(column="category", figsize=(16, 8))
```

## Sources, accuracy & provenance

- **Provenance changed in late July 2026 — this section was updated 2026-07-31 to say so.** The atlas started fully hand-built, and the **facts** still are: compiled from public references, not from any licensed dataset, so the CC BY 4.0 licence on the facts is the author's to grant.
- **Geometry: hand-traced originally, OSM-traced increasingly.** Each route's `LineString` began as hand-placed `[lon, lat]` waypoints following the corridor at map scale. From 23 July 2026 onward, alignments have progressively been re-traced from **OpenStreetMap railway ways via Overpass** so the lines sit on real track. The files currently in `data/` are the 23 July refresh: nearly all of their geometry is still the hand-traced kind, but a handful of corridors (Brenner, Oslo–Göteborg, Oslo–Stockholm, Pustertalbahn) are already OSM-traced, and those lines are **© OpenStreetMap contributors, ODbL** — as any OSM-derived geometry must be. An earlier version of this README said the geometry was "not extracted from OSM or any geodata source"; that was true when written (v1.0, 12 July) and is no longer true, which is why this notice exists. The next release will mark the split per route: facts CC BY 4.0, geometry ODbL. On the live site that re-tracing has since gone much further, which is why the site's routes and this package's routes are no longer the same lines.
- **Facts are approximate published values:** distance, top speed, journey time, operator, opening year and approximate ridership are compiled from public references (operators' own figures, timetables, press material, encyclopaedic articles). Individual facts like these aren't copyrightable; the licence covers the curated compilation. Good for exploration and visualization, not operations.
- **Curated, not exhaustive:** the world's *notable* routes, not every line on earth. Route names and the one-line `highlight`s are the author's own wording.
- **Deliberately excluded** (they live only on the site, to keep provenance clean): per-route stories and sights, photos (Wikimedia Commons, separately licensed), and the city-to-city journey guides (derived from public schedule feeds).
- **Basemap ≠ data:** the interactive site renders these routes over OpenFreeMap (OpenStreetMap) tiles; those tiles are **not** part of this dataset. OSM © OpenStreetMap contributors — which, per the provenance note above, now also covers the OSM-traced route lines themselves.

## License & attribution

- **Facts** (every non-geometry field in `data/`): [**CC BY 4.0**](https://creativecommons.org/licenses/by/4.0/), free to use, share and adapt, **with attribution to [World Train Map](https://worldtrainmap.com)**. A link to `https://worldtrainmap.com` (or the specific route page in `url`) satisfies attribution. ([full notice](data/LICENSE))
- **Geometry** (`LineString` coordinates): hand-traced lines as above (CC BY 4.0); **OSM-traced lines © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)**. If you reuse the geometry wholesale, treat it as ODbL and credit OpenStreetMap, which is the safe default, and will be made explicit per route in the next release.
- **Code** (the MCP server in `mcp/`): [MIT](LICENSE).

## Also available on

- **Hugging Face:** [huggingface.co/datasets/Flightmussy/trainrouter-atlas](https://huggingface.co/datasets/Flightmussy/trainrouter-atlas), currently the v1.1.0 cut (744 routes)
- **Zenodo (archived, DOI):** [doi.org/10.5281/zenodo.21322030](https://doi.org/10.5281/zenodo.21322030), the concept DOI, which always resolves to the latest published release (today, v1.1.0)

There is no Kaggle mirror. Earlier versions of this README linked one at `kaggle.com/datasets/albanius/...`; that account name does not exist, so the link was dead from the day it was written. It is removed here rather than repeated.

## Citing

> World Train Map Atlas: the world's legendary train routes (2026). worldtrainmap.com. DOI: 10.5281/zenodo.21322030. https://github.com/Flightmussy/trainrouter-atlas

## Updating

The data is generated from the atlas source by an exporter that is **currently blocked on purpose**, pending the split-licence work described above. That block is why `data/` has not moved since 23 July and why the last release is still v1.1.0. Once it is unblocked, new versions land here first, and publishing a GitHub release mints a fresh Zenodo DOI and pushes the mirrors via [`sync-mirrors.yml`](.github/workflows/sync-mirrors.yml), whose jobs each skip themselves when their API token is not configured.

## Also in this repo

- [`mcp/`](mcp/) — source of the World Train Map MCP server (live at `https://worldtrainmap.com/mcp`, listed in the [Official MCP Registry](https://registry.modelcontextprotocol.io) as `com.trainrouter/atlas`), which serves the atlas as tools for Claude and other MCP clients. It is deployed from the site's own atlas rather than from `data/`, so it is well ahead of the files here, though it is redeployed on its own schedule and can sit a little behind the site itself. Its `atlas_stats` tool reports exactly what it is serving.
