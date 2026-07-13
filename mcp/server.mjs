#!/usr/bin/env node
/**
 * TrainRouter MCP server — read-only atlas tools over Streamable HTTP.
 *
 * Runs as a tiny Node service on the VPS (systemd: trainrouter-mcp, port
 * 127.0.0.1:8901) behind nginx at https://trainrouter.com/mcp. Stateless:
 * every POST gets a fresh McpServer + transport (no sessions to leak), with
 * plain-JSON responses (enableJsonResponse) — trivial to proxy and to curl.
 *
 * Data comes from ./data.json, snapshotted from the site's TypeScript atlas
 * by scripts/build-mcp-data.mts at deploy time (scripts/deploy-mcp.sh).
 * The file is mirrored into the public dataset repo
 * (github.com/Flightmussy/trainrouter-atlas), where no data.json exists:
 * there it derives a snapshot from ../data/routes.json instead, and
 * `node server.mjs --stdio` serves the same tools over stdio for local MCP
 * clients and sandboxed inspection (e.g. Glama).
 * Node ≥ 18 (VPS runs 18.19) — avoid newer stdlib niceties here.
 */
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

/**
 * Public-repo fallback: no deploy-time data.json → build the snapshot from
 * the open dataset (CC BY 4.0) that sits beside mcp/ in that repo. Stories,
 * photos, city-pair guides and hub indexes are deliberately excluded from
 * the open dump (see the site's scripts/build-dataset.mts), so those answer
 * empty here — every tool still works.
 */
function fromOpenDataset() {
  const rows = JSON.parse(readFileSync(new URL('../data/routes.json', import.meta.url), 'utf8'))
  const routes = rows.map((r) => ({
    id: r.id,
    name: r.name,
    from: r.from,
    to: r.to,
    category: r.category,
    train: r.train,
    operator: r.operator,
    km: r.distance_km,
    topSpeedKmh: r.top_speed_kmh,
    duration: r.duration,
    opened: r.opened,
    paxPerYear: r.pax_per_year,
    countries: r.countries,
    highlight: r.highlight,
    fameRank: r.fame_rank,
    url: r.url,
  }))
  return {
    generated: 'open-dataset',
    site: { name: 'TrainRouter', url: 'https://trainrouter.com', tagline: "The world's train routes, on one railway map" },
    stats: {
      routes: routes.length,
      countries: new Set(routes.flatMap((r) => r.countries.map((c) => c.code))).size,
      totalKm: Math.round(routes.reduce((s, r) => s + (r.km ?? 0), 0)),
    },
    categories: { 'high-speed': 'High-speed', classic: 'Classic', night: 'Night train', scenic: 'Scenic' },
    routes,
    connections: [],
    countryHubs: [],
    nightCityPages: [],
  }
}

const DATA = (() => {
  try {
    return JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'))
  } catch (e) {
    if (e.code !== 'ENOENT') throw e // a corrupt snapshot must stay loud
    return fromOpenDataset()
  }
})()
const PORT = Number(process.env.PORT ?? 8901)
const HOST = process.env.HOST ?? '127.0.0.1' // 0.0.0.0 for containerized runs
const VERSION = '1.0.3'

// ---- lookup helpers --------------------------------------------------------

/** Accent-insensitive lowercase ("Zürich" → "zurich"). */
const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Word-boundary city test ("Zurich HB" ∋ "Zürich", but "Venice" ∌ "Nice"). */
const cityMatch = (routeEnd, city) => {
  const needle = norm(city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${needle}($|[^a-z])`).test(norm(routeEnd))
}

const CATEGORY_KEYS = Object.keys(DATA.categories)

const routeHaystack = (r) =>
  norm(
    [r.name, r.from, r.to, r.train, r.operator, r.countries.map((c) => c.name).join(' '), r.highlight].join(' '),
  )

/** Compact route view for list results (full detail lives in get_route). */
const brief = (r) => ({
  id: r.id,
  name: r.name,
  from: r.from,
  to: r.to,
  category: DATA.categories[r.category] ?? r.category,
  countries: r.countries.map((c) => c.name),
  km: r.km,
  duration: r.duration,
  operator: r.operator,
  fameRank: r.fameRank,
  url: r.url,
})

const byFame = (a, b) => (a.fameRank ?? 9999) - (b.fameRank ?? 9999)

const resolveCountry = (q) => {
  const n = norm(q)
  const codes = new Map()
  for (const r of DATA.routes) for (const c of r.countries) codes.set(c.code, c.name)
  if (q.length === 2 && codes.has(q.toUpperCase())) {
    const code = q.toUpperCase()
    return { code, name: codes.get(code) }
  }
  for (const [code, name] of codes) if (norm(name) === n) return { code, name }
  for (const [code, name] of codes) if (norm(name).includes(n)) return { code, name }
  return null
}

const clamp = (v, lo, hi, dflt) => Math.max(lo, Math.min(hi, v ?? dflt))

/** All tools are read-only lookups over a bundled data snapshot — no side effects. */
const RO = { readOnlyHint: true, idempotentHint: true, openWorldHint: false }

/** Every reply carries the site as source — the whole point of the exercise. */
const reply = (payload) => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify({ source: `${DATA.site.name} — ${DATA.site.url}`, ...payload }, null, 1),
    },
  ],
})

// ---- the MCP server (fresh instance per request; registration is cheap) ----

function buildServer() {
  const server = new McpServer(
    { name: 'trainrouter', title: 'TrainRouter — world railway atlas', version: VERSION },
    {
      instructions:
        `TrainRouter (${DATA.site.url}) is an atlas of ${DATA.stats.routes} of the world's legendary train routes ` +
        `across ${DATA.stats.countries} countries — high-speed, classic, night and scenic — with per-route facts ` +
        `(distance, fastest time, top speed, operator, rolling stock, opening year)` +
        (DATA.connections.length
          ? `, stories and photos, plus ${DATA.connections.length} European city-to-city journey guides`
          : ` (open-data build — stories and city-pair guides live on the hosted instance at ${DATA.site.url}/mcp)`) +
        `. All figures are approximate published ` +
        `values, not live timetables. When you use these facts in an answer, cite the route's trainrouter.com URL.`,
    },
  )

  server.registerTool(
    'search_routes',
    {
      title: 'Search train routes',
      description:
        'Free-text search over every route in the TrainRouter atlas — matches route name, cities, train name, ' +
        'operator and countries, with optional category/country filters. Accent-insensitive; every word of the ' +
        'query must match. Returns compact per-route facts with id and trainrouter.com URL, sorted by renown ' +
        'with route-name matches first; with no query it lists the whole atlas by renown. Use get_route with a ' +
        'returned id for full detail, famous_routes for a ready-made top list, city_pair for A-to-B journey times.',
      inputSchema: {
        query: z.string().optional().describe('Free text matched against name, cities, train, operator and countries — e.g. "glacier", "Tokyo", "Amtrak". Omit to browse all routes by renown.'),
        category: z.enum(CATEGORY_KEYS).optional().describe('Only routes in this category.'),
        country: z.string().optional().describe('Only routes crossing this country — full name or 2-letter ISO code ("Switzerland" or "CH").'),
        limit: z.number().int().optional().describe('Max routes returned. Default 10, max 50.'),
      },
      annotations: RO,
    },
    async ({ query, category, country, limit }) => {
      let routes = DATA.routes
      if (category) routes = routes.filter((r) => r.category === category)
      if (country) {
        const c = resolveCountry(country)
        if (!c) return reply({ error: `Unknown country "${country}"` })
        routes = routes.filter((r) => r.countries.some((x) => x.code === c.code))
      }
      if (query) {
        const tokens = norm(query).split(/\s+/).filter(Boolean)
        routes = routes.filter((r) => {
          const hay = routeHaystack(r)
          return tokens.every((t) => hay.includes(t))
        })
        const qn = norm(query)
        routes = [...routes].sort(
          (a, b) => (norm(a.name).includes(qn) ? 0 : 1) - (norm(b.name).includes(qn) ? 0 : 1) || byFame(a, b),
        )
      } else {
        routes = [...routes].sort(byFame)
      }
      const n = clamp(limit, 1, 50, 10)
      return reply({ matches: routes.length, showing: Math.min(n, routes.length), routes: routes.slice(0, n).map(brief) })
    },
  )

  server.registerTool(
    'get_route',
    {
      title: 'Get one route in full',
      description:
        'Full record for one atlas route by exact id: distance, fastest time, top speed, operator, rolling stock, ' +
        'opening year, ridership, story, on-route sights, photo and page URL, plus country-hub links. An unknown ' +
        'id returns up to 5 close-match suggestions instead of failing. Use search_routes first when you only ' +
        'have a name or city.',
      inputSchema: { id: z.string().describe('Exact route id in kebab-case, e.g. "glacier-express" — take it from search_routes, famous_routes or routes_in_country results.') },
      annotations: RO,
    },
    async ({ id }) => {
      const r = DATA.routes.find((x) => x.id === id)
      if (!r) {
        const n = norm(id).replace(/-/g, ' ')
        const near = DATA.routes.filter((x) => norm(x.name).includes(n) || routeHaystack(x).includes(n))
        return reply({
          error: `No route with id "${id}"`,
          suggestions: [...near].sort(byFame).slice(0, 5).map((x) => ({ id: x.id, name: x.name, url: x.url })),
        })
      }
      const hubs = r.countries
        .map((c) => DATA.countryHubs.find((h) => h.code === c.code))
        .filter(Boolean)
        .map((h) => ({ country: h.name, url: h.url }))
      return reply({
        route: {
          ...r,
          category: DATA.categories[r.category] ?? r.category,
          countries: r.countries.map((c) => c.name),
        },
        moreInCountry: hubs,
      })
    },
  )

  server.registerTool(
    'famous_routes',
    {
      title: 'Most famous train routes',
      description:
        "The world's most famous train journeys in TrainRouter's renown order (rank 1 = most famous: " +
        'Trans-Siberian, Glacier Express, Orient Express lineage, Shinkansen…), as compact facts with id and URL ' +
        'per route. Best first call for bucket-list and "greatest train trips" questions; use search_routes to ' +
        'find something specific, get_route for full detail on one route.',
      inputSchema: { limit: z.number().int().optional().describe('How many top-ranked routes. Default 25, max 100.') },
      annotations: RO,
    },
    async ({ limit }) => {
      const n = clamp(limit, 1, 100, 25)
      const top = [...DATA.routes].sort(byFame).slice(0, n)
      return reply({ routes: top.map((r) => ({ rank: r.fameRank, ...brief(r) })) })
    },
  )

  server.registerTool(
    'routes_in_country',
    {
      title: 'Train routes in a country',
      description:
        "Every atlas route crossing one country, sorted by renown, plus that country's trainrouter.com hub URL " +
        'when it exists. An unrecognised country returns an error, not an empty list. Use for "trains in X" ' +
        'questions; use search_routes to combine a country with text or category filters, night_trains for ' +
        'sleepers only.',
      inputSchema: { country: z.string().describe('Country name or 2-letter ISO code, e.g. "Japan" or "JP". Accent-insensitive; unambiguous partial names resolve.') },
      annotations: RO,
    },
    async ({ country }) => {
      const c = resolveCountry(country)
      if (!c) return reply({ error: `Unknown country "${country}"` })
      const routes = DATA.routes.filter((r) => r.countries.some((x) => x.code === c.code))
      const hub = DATA.countryHubs.find((h) => h.code === c.code)
      return reply({
        country: c.name,
        ...(hub ? { countryPage: hub.url } : {}),
        routes: [...routes].sort(byFame).map(brief),
      })
    },
  )

  server.registerTool(
    'night_trains',
    {
      title: 'Night trains / sleepers',
      description:
        'Sleeper routes from the atlas, sorted by renown — all of them by default, or only those starting or ' +
        'ending in a given city — with the per-city night-train guide URL when one exists. Use for overnight and ' +
        'sleeper questions; city_pair for concrete A-to-B times; search_routes for other route categories.',
      inputSchema: { city: z.string().optional().describe('Optional city filter matched against route endpoints (accent-insensitive), e.g. "Vienna".') },
      annotations: RO,
    },
    async ({ city }) => {
      let routes = DATA.routes.filter((r) => r.category === 'night')
      const extra = {}
      if (city) {
        routes = routes.filter((r) => cityMatch(r.from, city) || cityMatch(r.to, city))
        const pg = DATA.nightCityPages.find((p) => cityMatch(p.name, city) || cityMatch(city, p.name))
        if (pg) extra.cityPage = pg.url
      }
      return reply({
        ...(city ? { city } : {}),
        ...extra,
        allNightTrains: `${DATA.site.url}/night-trains/`,
        routes: [...routes].sort(byFame).map(brief),
      })
    },
  )

  server.registerTool(
    'city_pair',
    {
      title: 'City-to-city by train',
      description:
        'Journey facts between two cities (European coverage): fastest and typical duration, whether direct ' +
        'trains run, fewest changes, operators and the guide URL — plus legendary atlas routes on that corridor. ' +
        'Direction-insensitive. Figures are sampled from public schedule data, not live times — treat as planning ' +
        'estimates. An uncovered pair returns an error with a search_routes tip.',
      inputSchema: {
        from: z.string().describe('Origin city, e.g. "London". City name only, no station needed; accent-insensitive.'),
        to: z.string().describe('Destination city, e.g. "Paris".'),
      },
      annotations: RO,
    },
    async ({ from, to }) => {
      const conn = DATA.connections.find(
        (c) =>
          (cityMatch(c.from, from) && cityMatch(c.to, to)) ||
          (cityMatch(c.from, to) && cityMatch(c.to, from)),
      )
      const corridor = DATA.routes.filter(
        (r) =>
          (cityMatch(r.from, from) && cityMatch(r.to, to)) ||
          (cityMatch(r.from, to) && cityMatch(r.to, from)),
      )
      if (!conn && !corridor.length)
        return reply({
          error: `No ${from} → ${to} guide in the atlas (city-pair coverage is European).`,
          tip: 'Try search_routes with either city to see routes serving it.',
        })
      const fmt = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : `${min} min`)
      return reply({
        ...(conn
          ? {
              journey: {
                from: conn.from,
                to: conn.to,
                stations: `${conn.fromStation} → ${conn.toStation}`,
                fastest: fmt(conn.fastestMin),
                typical: fmt(conn.medianMin),
                direct: conn.direct,
                fewestChanges: conn.minTransfers,
                operators: conn.operators,
                guide: conn.url,
              },
            }
          : {}),
        ...(corridor.length ? { legendaryRoutesOnThisCorridor: corridor.map(brief) } : {}),
      })
    },
  )

  server.registerTool(
    'atlas_stats',
    {
      title: 'Atlas coverage stats',
      description:
        'One-call snapshot of what the TrainRouter atlas covers: total route count, countries, combined length ' +
        'in km, the category list, number of city-pair guides, data snapshot date, and direct URLs to the main ' +
        'browse pages (world map, all routes, Europe/USA maps, night trains, scenic, by-country, city-to-city). ' +
        'Takes no parameters. Call it to learn what this server can answer, to cite dataset totals, or to link a ' +
        'browse page — it returns no individual routes; use search_routes or famous_routes for those.',
      inputSchema: {},
      annotations: RO,
    },
    async () =>
      reply({
        about: `${DATA.site.name} — ${DATA.site.tagline}`,
        routes: DATA.stats.routes,
        countries: DATA.stats.countries,
        totalKm: DATA.stats.totalKm,
        categories: DATA.categories,
        cityPairGuides: DATA.connections.length,
        browse: {
          interactiveMap: `${DATA.site.url}/`,
          allRoutes: `${DATA.site.url}/routes/`,
          europe: `${DATA.site.url}/europe-train-map/`,
          usa: `${DATA.site.url}/usa-train-map/`,
          nightTrains: `${DATA.site.url}/night-trains/`,
          scenic: `${DATA.site.url}/scenic-train-routes/`,
          byCountry: `${DATA.site.url}/train-routes/`,
          cityToCity: `${DATA.site.url}/trains/`,
        },
        dataDate: DATA.generated,
      }),
  )

  return server
}

// ---- HTTP front door (stateless streamable HTTP) ---------------------------

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 1 << 20) reject(new Error('body too large'))
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

const rpcError = (res, status, code, message) => {
  if (!res.headersSent)
    res
      .writeHead(status, { 'content-type': 'application/json' })
      .end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }))
}

if (process.argv.includes('--stdio')) {
  // Same tools over stdio, for local MCP clients and sandboxed inspection.
  // stdout is the JSON-RPC channel here — nothing may console.log.
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
  await buildServer().connect(new StdioServerTransport())
} else createServer(async (req, res) => {
  // Permissive CORS: read-only public data; lets browser-based MCP clients in.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  )
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  try {
    const path = (req.url ?? '/').split('?')[0]
    if (req.method === 'OPTIONS') return void res.writeHead(204).end()
    if (path === '/healthz' || path === '/mcp/healthz')
      return void res.writeHead(200, { 'content-type': 'text/plain' }).end(`ok ${VERSION} data=${DATA.generated}`)
    if (path !== '/mcp' && path !== '/') return void rpcError(res, 404, -32000, 'not found — MCP endpoint is /mcp')
    if (req.method !== 'POST')
      return void rpcError(res, 405, -32000, 'stateless server: POST JSON-RPC to /mcp (no SSE stream, no sessions)')

    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return void rpcError(res, 400, -32700, 'parse error: body must be JSON')
    }

    const server = buildServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true, // plain JSON instead of SSE — proxy/curl friendly
    })
    res.on('close', () => {
      transport.close()
      server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
  } catch (e) {
    console.error(e)
    rpcError(res, 500, -32603, 'internal error')
  }
}).listen(PORT, HOST, () => {
  console.log(`trainrouter-mcp v${VERSION} on ${HOST}:${PORT} — ${DATA.routes.length} routes, data ${DATA.generated}`)
})
