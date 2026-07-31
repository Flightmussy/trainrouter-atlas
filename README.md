# TrainRouter Atlas — the world's legendary train routes, as open data

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21322030.svg)](https://doi.org/10.5281/zenodo.21322030)

**961 train routes · 118 countries · ≈ 432,800 km of route** — every route with its key facts and hand-traced geometry, from [trainrouter.com](https://trainrouter.com), the interactive world railway map.

High-speed spines (Eurostar, TGV, Shinkansen, AVE), classic long-distance runs (Trans-Siberian, California Zephyr), night trains (Nightjet, the Ghan) and the scenic lines people fly in just to ride (Glacier Express, Bernina Express, the Jacobite).

🗺️ **Explore it interactively:** [trainrouter.com](https://trainrouter.com)
🤖 **Use it from an AI assistant:** free MCP server at `https://trainrouter.com/mcp` ([how to connect](https://trainrouter.com/mcp-server/)) — or run it from this repo: `npm install && npm start` ([`mcp/`](mcp/))

## Files

| File | Contents |
|---|---|
| `data/routes.csv` | One row per route — all facts, no geometry |
| `data/routes.json` | Same records with structured country objects |
| `data/routes.geojson` | `LineString` per route (lon/lat waypoints) + all facts as properties |

## Schema

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, e.g. `glacier-express` |
| `name` | string | Route/service name |
| `from`, `to` | string | Terminus cities |
| `category` | enum | `high-speed` · `classic` · `night` · `scenic` |
| `train` | string | Rolling stock, e.g. `e320 · Class 374` |
| `operator` | string | Operating company |
| `distance_km` | number | Route length |
| `top_speed_kmh` | number | Service top speed |
| `duration` | string | Published journey time, e.g. `2 h 16 min` |
| `opened` | number | Year the line/service entered service |
| `pax_per_year` | number\|null | Approx. annual ridership where published |
| `countries_iso` / `countries` | string | `\|`-separated, in travel order (CSV); structured objects in JSON |
| `highlight` | string | One-line description of what makes the route legendary |
| `fame_rank` | number | 1 = most famous (TrainRouter renown ranking) |
| `url` | string | The route's page on trainrouter.com |

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
- **Geometry: hand-traced originally, OSM-traced increasingly.** Each route's `LineString` began as hand-placed `[lon, lat]` waypoints following the corridor at map scale. From 23 July 2026 onward, alignments have progressively been re-traced from **OpenStreetMap railway ways via Overpass** so the lines sit on real track. The files currently in `data/` are the 23 July refresh: nearly all of their geometry is still the hand-traced kind, but a handful of corridors (Brenner, Oslo–Göteborg, Oslo–Stockholm, Pustertalbahn) are already OSM-traced, and those lines are **© OpenStreetMap contributors, ODbL** — as any OSM-derived geometry must be. An earlier version of this README said the geometry was "not extracted from OSM or any geodata source"; that was true when written (v1.0, 12 July) and is no longer true, which is why this notice exists. The next release will mark the split per route: facts CC BY 4.0, geometry ODbL.
- **Facts are approximate published values:** distance, top speed, journey time, operator, opening year and approximate ridership are compiled from public references (operators' own figures, timetables, press material, encyclopaedic articles). Individual facts like these aren't copyrightable; the licence covers the curated compilation. Good for exploration and visualization, not operations.
- **Curated, not exhaustive:** the world's *notable* routes, not every line on earth. Route names and the one-line `highlight`s are the author's own wording.
- **Deliberately excluded** (they live only on the site, to keep provenance clean): per-route stories and sights, photos (Wikimedia Commons, separately licensed), and the city-to-city journey guides (derived from public schedule feeds).
- **Basemap ≠ data:** the interactive site renders these routes over OpenFreeMap (OpenStreetMap) tiles; those tiles are **not** part of this dataset. OSM © OpenStreetMap contributors — which, per the provenance note above, now also covers the OSM-traced route lines themselves.

## License & attribution

- **Facts** (every non-geometry field in `data/`): [**CC BY 4.0**](https://creativecommons.org/licenses/by/4.0/) — free to use, share and adapt, **with attribution to [TrainRouter](https://trainrouter.com)**. A link to `https://trainrouter.com` (or the specific route page in `url`) satisfies attribution. ([full notice](data/LICENSE))
- **Geometry** (`LineString` coordinates): hand-traced lines as above (CC BY 4.0); **OSM-traced lines © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)**. If you reuse the geometry wholesale, treat it as ODbL and credit OpenStreetMap — the safe default, made explicit per route in the next release.
- **Code** (the MCP server in `mcp/`): [MIT](LICENSE).

## Also available on

- **Kaggle:** [kaggle.com/datasets/albanius/world-train-routes-trainrouter-atlas](https://www.kaggle.com/datasets/albanius/world-train-routes-trainrouter-atlas)
- **Hugging Face:** [huggingface.co/datasets/Flightmussy/trainrouter-atlas](https://huggingface.co/datasets/Flightmussy/trainrouter-atlas)
- **Zenodo (archived, DOI):** [doi.org/10.5281/zenodo.21322030](https://doi.org/10.5281/zenodo.21322030) — always resolves to the latest version

## Citing

> TrainRouter Atlas: the world's legendary train routes (2026). trainrouter.com. DOI: 10.5281/zenodo.21322030. https://github.com/Flightmussy/trainrouter-atlas

## Updating

The data is generated from the TrainRouter atlas source. New versions land here first; publishing a GitHub release mints a fresh Zenodo DOI and (once the repo's `KAGGLE_API_TOKEN`/`HF_TOKEN` secrets are configured) syncs the [Kaggle](https://www.kaggle.com/datasets/albanius/world-train-routes-trainrouter-atlas) and [Hugging Face](https://huggingface.co/datasets/Flightmussy/trainrouter-atlas) mirrors automatically via [`sync-mirrors.yml`](.github/workflows/sync-mirrors.yml).

## Also in this repo

- [`mcp/`](mcp/) — source of the TrainRouter MCP server (live at `https://trainrouter.com/mcp`, listed in the [Official MCP Registry](https://registry.modelcontextprotocol.io) as `com.trainrouter/atlas`), which serves this atlas as tools for Claude and other MCP clients.
