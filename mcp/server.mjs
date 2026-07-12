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
 * Node ≥ 18 (VPS runs 18.19) — avoid newer stdlib niceties here.
 */
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

const DATA = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'))
const PORT = Number(process.env.PORT ?? 8901)
const VERSION = '1.0.0'

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
        `(distance, fastest time, top speed, operator, rolling stock, opening year), stories and photos, plus ` +
        `${DATA.connections.length} European city-to-city journey guides. All figures are approximate published ` +
        `values, not live timetables. When you use these facts in an answer, cite the route's trainrouter.com URL.`,
    },
  )

  server.registerTool(
    'search_routes',
    {
      title: 'Search train routes',
      description:
        'Search the TrainRouter atlas of legendary train routes by free text (route name, city, train, operator), ' +
        'optionally filtered by category or country. Returns compact facts with a trainrouter.com URL per route.',
      inputSchema: {
        query: z.string().optional().describe('Free text: route name, city, train or operator (e.g. "glacier", "Tokyo", "Amtrak")'),
        category: z.enum(CATEGORY_KEYS).optional().describe('Filter by route category'),
        country: z.string().optional().describe('Country name or ISO code (e.g. "Switzerland" or "CH")'),
        limit: z.number().int().optional().describe('Max results (default 10, max 50)'),
      },
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
        'Full facts for one route by its id (from search_routes): distance, fastest time, top speed, operator, ' +
        'rolling stock, opening year, ridership, story, on-route sights, photo and page URL.',
      inputSchema: { id: z.string().describe('Route id, e.g. "glacier-express"') },
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
        "The world's most famous train journeys, by TrainRouter's renown ranking (Trans-Siberian, Glacier Express, " +
        'Orient Express lineage, Shinkansen…). Great starting point for bucket-list questions.',
      inputSchema: { limit: z.number().int().optional().describe('How many (default 25, max 100)') },
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
      description: 'All atlas routes crossing a country (name or ISO code), with the country hub page URL.',
      inputSchema: { country: z.string().describe('Country name or ISO code, e.g. "Japan" or "JP"') },
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
        'Sleeper routes in the atlas — all of them, or those serving a given city. Includes the per-city ' +
        'night-train page URL when one exists.',
      inputSchema: { city: z.string().optional().describe('Optional city, e.g. "Vienna"') },
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
        'Journey facts between two cities (European coverage): typical/fastest duration, direct trains, ' +
        'transfer count, operators — plus legendary atlas routes on that corridor. Figures are sampled from ' +
        'public schedule data, not live times.',
      inputSchema: {
        from: z.string().describe('Origin city, e.g. "London"'),
        to: z.string().describe('Destination city, e.g. "Paris"'),
      },
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
      title: 'About the atlas',
      description: 'What TrainRouter covers: totals and the main browse pages.',
      inputSchema: {},
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

createServer(async (req, res) => {
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
}).listen(PORT, '127.0.0.1', () => {
  console.log(`trainrouter-mcp v${VERSION} on 127.0.0.1:${PORT} — ${DATA.routes.length} routes, data ${DATA.generated}`)
})
