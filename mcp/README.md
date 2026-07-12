# TrainRouter MCP server

The atlas as tools for AI assistants — search routes, pull route facts, list night trains, check city-to-city journey times.

**You don't need to run this.** A free hosted instance is live:

```
https://trainrouter.com/mcp
```

- **Claude (claude.ai):** Settings → Connectors → *Add custom connector* → paste the URL
- **Claude Code:** `claude mcp add --transport http trainrouter https://trainrouter.com/mcp`
- **Any MCP client:** `{ "mcpServers": { "trainrouter": { "type": "http", "url": "https://trainrouter.com/mcp" } } }`

Registry entry: [`com.trainrouter/atlas`](https://registry.modelcontextprotocol.io/v0/servers?search=trainrouter) · Details: [trainrouter.com/mcp-server](https://trainrouter.com/mcp-server/)

## About this code

`server.mjs` is the exact source of the hosted server: plain Node ≥ 18, stateless Streamable-HTTP JSON-RPC, no auth, read-only. It loads `data.json` — a snapshot generated from the site's source at deploy time, which includes per-route stories that are not part of the open dataset — so the snapshot itself is not included here. To experiment, adapt the loader to `../data/routes.json` from this repo.

Tools: `search_routes` · `get_route` · `famous_routes` · `routes_in_country` · `night_trains` · `city_pair` · `atlas_stats`
