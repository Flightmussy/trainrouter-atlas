# TrainRouter Atlas — the world's legendary train routes, as open data

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21322030.svg)](https://doi.org/10.5281/zenodo.21322030)

**744 train routes · 118 countries · ≈ 366,500 km of line** — every route with its key facts and hand-traced geometry, from [trainrouter.com](https://trainrouter.com), the interactive world railway map.

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

## Accuracy & provenance

- Figures are **approximate published values** (operator sites, timetables, press material) — good for exploration and visualization, not operations.
- Geometry is **hand-traced at map scale** to follow each line's real corridor — it is not survey-grade track alignment.
- The dataset is curated: it covers the world's *notable* routes, not every railway line on earth.
- Not included here (they live on the site): per-route stories and sights, photos, and city-to-city journey guides.

## License & attribution

[**CC BY 4.0**](https://creativecommons.org/licenses/by/4.0/) — free to use, share and adapt, **with attribution to [TrainRouter](https://trainrouter.com)**. A link to `https://trainrouter.com` (or the specific route page in `url`) satisfies attribution.

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
