# CardPilot Remote MCP Server

This is a remote [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for CardPilot. It exposes tools to fetch and analyze credit card data.

## Server URL

**Public URL**: `https://mcp.cardpilot.ca/sse`

> **Note**: This server uses a custom domain to ensure compatibility with OpenAI Agent Builder.

## Available Tools

### `get-cards`
Fetches a ranked list of credit cards with details (annual fee, rewards, perks, etc.).

**Arguments:**
- `sort` (optional): `recommended`, `welcome_offer`, `interest_rate`, `annual_fee`, `net_value`
- `direction` (optional): `asc`, `desc`

## How to Use

### OpenAI Agent Builder
1. Create a new Agent.
2. Under **Actions**, click **Add Action**.
3. Select "Add from URL".
4. Enter: `https://mcp.cardpilot.ca/sse`
5. It should load the `get-cards` tool immediately.

### Cloudflare AI Playground
1. Go to [https://playground.ai.cloudflare.com/](https://playground.ai.cloudflare.com/)
2. Enter the server URL: `https://mcp.cardpilot.ca/sse`
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
        "https://mcp.cardpilot.ca/sse"
      ]
    }
  }
}
```

## Troubleshooting

### OpenAI 424 Error ("Unable to load tools")
If you see this error, ensure you are using the **Custom Domain** URL (`mcp.cardpilot.ca`).
OpenAI blocks generic `.workers.dev` domains for MCP servers.

### Local Development
To test locally:

1. Install dependencies:
```bash
npm install
```

2. Start local server:
```bash
npm start
```
(Runs on port 8787)

3. **Expose via Ngrok** (Required for OpenAI testing):
```bash
ngrok http 8787
```
Use the Ngrok URL (e.g., `https://xxxx.ngrok-free.app/sse`) in Agent Builder.

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```
The server will be live at `https://mcp.cardpilot.ca/sse`.
