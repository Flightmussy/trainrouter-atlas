# World Train Map Atlas — the world's legendary train routes, as open data

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21322030.svg)](https://doi.org/10.5281/zenodo.21322030)

**1,538 train routes · 120 countries · ≈ 531,400 km of route**, every route with its key facts and its line, from [worldtrainmap.com](https://worldtrainmap.com), the interactive world railway map.

High-speed spines (Eurostar, TGV, Shinkansen, AVE), classic long-distance runs (Trans-Siberian, California Zephyr), night trains (Nightjet, the Ghan), the scenic lines people fly in just to ride (Glacier Express, Bernina Express, the Jacobite), and the heritage and mountain railways around them.

🗺️ **Explore it interactively:** [worldtrainmap.com](https://worldtrainmap.com)
🤖 **Use it from an AI assistant:** free MCP server at `https://worldtrainmap.com/mcp` ([how to connect](https://worldtrainmap.com/mcp-server/)), or run it from this repo: `npm install && npm start` ([`mcp/`](mcp/))

> **The site was renamed.** It was TrainRouter at `trainrouter.com` until 11 August 2026 and is now World Train Map at `worldtrainmap.com`. The old domain redirects path for path, so old links still work, and `https://trainrouter.com/mcp` still answers directly rather than redirecting, because JSON-RPC clients do not follow redirects. The repository, the Zenodo DOI and the MCP registry name (`com.trainrouter/atlas`) keep their old identifiers on purpose: renaming them would break more than it would tidy.

## Two licences

Since the 8 November 2026 cut (release v1.2.0) the files carry two licences, because the lines and the facts come from different places:

| File | What it holds | Licence |
|---|---|---|
| `data/routes.csv` | One row per route, all facts, no geometry | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), credit World Train Map |
| `data/routes.json` | The same records, with structured country objects | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), credit World Train Map |
| `data/routes.geojson` | A `LineString` per route, with every fact as a property | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) |
| `data/LICENSE` | The licence notice for the three files, written by the exporter | |

The lines are derived from OpenStreetMap: 1,396 of the 1,538 are drawn node for node from OSM route relations, 26 are snapped onto the OSM rail graph by map matching, and the other 116 have no record of their origin, which is not evidence that they are ours, so they are treated as derived too. The whole GeoJSON is therefore ODbL, including the facts repeated in its properties; the same facts stay CC BY 4.0 in the CSV and JSON. If you only need the facts, use those two files and the ODbL never applies.

## Which version holds what

| Where | Routes | Cut | Note |
|---|---|---|---|
| The live site | 1,538 | 8 November 2026 | [worldtrainmap.com](https://worldtrainmap.com), always the newest |
| `data/` in this repo, Hugging Face, Kaggle (facts only) | 1,538 | 8 November 2026 | the same routes as the live site that day |
| Zenodo (the citable DOI) | 1,538 | 8 November 2026 | release v1.2.0 |
| The MCP server | 1,516 | 7 October 2026 | deployed separately from the site, so it lags it a little; its `atlas_stats` tool reports the current figure |

Earlier releases (v1.0.0 and v1.1.0 on 12 July, the 23 July cut of 961 routes) labelled every file CC BY 4.0. The 12 July lines were hand-placed, but the 23 July cut already held a handful of corridors traced from OpenStreetMap (Brenner, Oslo–Göteborg, Oslo–Stockholm, the Pustertalbahn), and those lines were ODbL all along; this release is the first that says so file by file.

## Schema

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, e.g. `glacier-express` |
| `name` | string | Route/service name |
| `from`, `to` | string | Terminus cities |
| `category` | enum | `high-speed` · `classic` · `night` · `scenic` · `heritage` · `mountain` · `luxury` |
| `train` | string | Rolling stock, e.g. `e320 · Class 374` |
| `operator` | string | Operating company |
| `distance_km` | number | Route length |
| `top_speed_kmh` | number\|null | Service top speed, where a credible figure exists (1,262 of 1,538 rows) |
| `duration` | string | Published journey time, e.g. `2 h 16 min` |
| `opened` | number | Year the line/service entered service |
| `pax_per_year` | number\|null | Approx. annual ridership where published, which is rare: 89 of the 1,538 rows carry one |
| `countries_iso` / `countries` | string | `\|`-separated, in travel order (CSV); structured objects in JSON |
| `highlight` | string | One-line description of what makes the route notable |
| `fame_rank` | number | 1 = most famous (the atlas's own renown ranking) |
| `url` | string | The route's page on worldtrainmap.com |

Three more properties, in `routes.geojson` only:

| Field | Type | Notes |
|---|---|---|
| `geometry_source` | string\|null | `osm_relation` (drawn from the OSM route relations in `osm_relations`), `osm_map_matched` (snapped onto the OSM rail graph), or null where no record of the line's origin exists |
| `osm_relations` | string\|null | `\|`-separated ids of the OSM relations the line was drawn from, e.g. `2905798` for Eurostar London–Paris |
| `geometry_licence` | string | `ODbL-1.0` on every feature |

The GeoJSON FeatureCollection also carries `license` and `attribution` members, so the credit travels with the file.

## Quick start

```python
import pandas as pd
routes = pd.read_csv("data/routes.csv")
routes.nsmallest(10, "fame_rank")[["name", "from", "to", "distance_km"]]

import geopandas as gpd
gdf = gpd.read_file("data/routes.geojson")   # ODbL: credit © OpenStreetMap contributors
gdf.plot(column="category", figsize=(16, 8))
```

## Sources, accuracy & provenance

- **Facts** are compiled from public references, not from any licensed dataset: operators' own figures, timetables, press material and encyclopaedic articles. A few distance and top-speed figures were measured on OpenStreetMap track instead; they are a small, insubstantial extract of the OpenStreetMap database. Individual facts like these aren't copyrightable; the licence covers the curated compilation.
- **Geometry** began as hand-placed waypoints in July 2026 and has since been redrawn from OpenStreetMap: from route relations where mappers describe the service, and by map matching onto the OSM rail graph where they do not. Each feature says which, where a record exists.
- **Facts are approximate published values**: distance, top speed, journey time, operator, opening year and ridership. Good for exploration and visualization, not operations.
- **Curated, not exhaustive:** the world's *notable* routes, not every line on earth. Route names and the one-line `highlight`s are the author's own wording.
- **Deliberately excluded** (they live only on the site, to keep provenance clean): per-route stories and sights, photos (Wikimedia Commons, separately licensed), and the city-to-city journey guides (derived from public schedule feeds).
- **Basemap ≠ data:** the interactive site renders these routes over OpenFreeMap (OpenStreetMap) tiles; those tiles are not part of this dataset.

## License & attribution

- **Facts** (`data/routes.csv`, `data/routes.json`): [**CC BY 4.0**](https://creativecommons.org/licenses/by/4.0/). Credit **[World Train Map](https://worldtrainmap.com)**; a link to `https://worldtrainmap.com`, or to the route page in `url`, satisfies it.
- **Lines** (`data/routes.geojson`): [**ODbL 1.0**](https://opendatacommons.org/licenses/odbl/1-0/), **© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)**. A database you derive from it and use publicly must be offered under the ODbL too; a map or image made from it needs the credit "© OpenStreetMap contributors". ([full notice](data/LICENSE))
- **Code** (the MCP server in `mcp/`): [MIT](LICENSE).

## Also available on

- **Hugging Face:** [huggingface.co/datasets/Flightmussy/trainrouter-atlas](https://huggingface.co/datasets/Flightmussy/trainrouter-atlas), the three files of `data/`, under the same two licences
- **Kaggle:** [kaggle.com/datasets/flightmussy/world-train-routes](https://www.kaggle.com/datasets/flightmussy/world-train-routes), the two fact files only, because Kaggle allows a dataset one licence label and the lines are ODbL
- **Zenodo (archived, DOI):** [doi.org/10.5281/zenodo.21322030](https://doi.org/10.5281/zenodo.21322030), the concept DOI, which always resolves to the latest published release. Zenodo allows one licence label per record, so from v1.2.0 the record is labelled ODbL, which covers the whole archive; the fact files inside it are also CC BY 4.0

Until 24 August 2026 this README and the site linked a Kaggle mirror at `kaggle.com/datasets/albanius/...`. That account name has never been ours and the link was dead from the day it was written; the mirror above is the real one.

## Citing

> World Train Map Atlas: the world's legendary train routes (2026). worldtrainmap.com. DOI: 10.5281/zenodo.21322030. https://github.com/Flightmussy/trainrouter-atlas. Route lines © OpenStreetMap contributors, ODbL.

## Updating

The files are generated from the atlas source by the site's exporter, which writes `routes.csv`, `routes.json`, `routes.geojson` and `data/LICENSE` together, so the notice cannot drift from the files. New versions land here first; publishing a GitHub release mints a fresh Zenodo DOI and pushes the mirrors via [`sync-mirrors.yml`](.github/workflows/sync-mirrors.yml), whose jobs each skip themselves when their API token is not configured.

## Also in this repo

- [`mcp/`](mcp/) — source of the World Train Map MCP server (live at `https://worldtrainmap.com/mcp`, listed in the [Official MCP Registry](https://registry.modelcontextprotocol.io) as `com.trainrouter/atlas`), which serves the atlas as tools for Claude and other MCP clients. It is deployed from the site's own atlas rather than from `data/`, and it serves facts only, no geometry. Its `atlas_stats` tool reports exactly what it is serving.
