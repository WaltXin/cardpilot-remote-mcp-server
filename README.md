# CardPilot Remote MCP Server

This is a remote [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for CardPilot. It exposes tools to fetch and analyze credit card data.

## Server URL

Public URL: `https://cardpilot-remote-mcp-server.mcps.workers.dev/sse`

## Available Tools

### `get-cards`
Fetches a ranked list of credit cards with details (annual fee, rewards, perks, etc.).

**Arguments:**
- `sort` (optional): `recommended`, `welcome_offer`, `interest_rate`, `annual_fee`, `net_value`
- `direction` (optional): `asc`, `desc`

## How to Use

### Cloudflare AI Playground
1. Go to [https://playground.ai.cloudflare.com/](https://playground.ai.cloudflare.com/)
2. Enter the server URL: `https://cardpilot-remote-mcp-server.mcps.workers.dev/sse`
3. Click **Connect**.

### Claude Desktop
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cardpilot": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://cardpilot-remote-mcp-server.mcps.workers.dev/sse"
      ]
    }
  }
}
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Run locally:
```bash
npm start
```

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```
