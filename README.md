# CardPilot Remote MCP Server

This is a remote [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for CardPilot. It exposes tools to fetch and analyze credit card data.

## Server URL

**Public URL**: `https://mcp.cardpilot.ca/sse`

> **Note**: This server uses a custom domain to ensure compatibility with OpenAI Agent Builder.

## Available Tools

### 1. `get-cards`
Fetches a list of credit cards with detailed metadata, suitable for ranking and comparison.

**Input parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sort` | `string` (enum) | Sort criteria: `recommended`, `welcome_offer`, `interest_rate`, `annual_fee`, `net_value` |
| `direction` | `string` (enum) | Sort direction: `asc`, `desc` |
| `ids` | `string` | Comma-separated list of card IDs (e.g., `card-a,card-b`) |
| `bank` | `string` | Filter by bank name (e.g., "TD", "RBC") |
| `category` | `string` | Filter by category (e.g., "travel", "cash back") |
| `noFee` | `boolean` | Set to `true` to filter for no-annual-fee cards |

**Output structure:**
```json
{
  "cards": [
    {
      "cardId": "string",
      "name": "string",
      "bank": "string",
      "annualFee": number,
      "score": number,
      "details": { "rewards": number, "perks": number, "fees": number, ... }
    }
  ],
  "meta": { "total": number, "sort": "string", "direction": "string" }
}
```

### 2. `get-guides`
Fetches a list of educational guide metadata. This tool is optimized for chatbots to provide links to full articles.

**Input parameters:** None

**Output structure:**
```json
{
  "guides": [
    {
      "slug": "string",
      "title": "string",
      "intro": "string",
      "icon": "string (emoji)",
      "url": "string"
    }
  ]
}
```

## Agent System Prompt
If you are using this MCP server with an LLM Agent (like OpenAI Custom GPT), add the following to your System Instructions:

```text
You are an expert credit card advisor powered by CardPilot data.

1. **Card Recommendations**:
   - ALWAYS use the `get-cards` tool to fetch real-time data before making recommendations.
   - Use the `sort` parameter to align with user priorities (e.g., `sort="annual_fee"` for cheap cards).
   - Use filters like `bank="TD"` or `category="travel"` to narrow down results.
   - For "no fee" requests, explicitly set `noFee=true`.
   - When presenting cards, list the Name, Annual Fee, Welcome Bonus, and a brief "Why it fits" explanation.
   - Link the card name to the `applyUrl` or CardPilot detail page if available.

2. **Educational Content**:
   - If a user asks general questions (e.g., "Cash back vs Points"), use `get-guides` to see if there is a relevant article.
   - Provide the answer based on the guide's `intro` and encourage the user to read the full guide by providing the `url`.

3. **General Rules**:
   - Do not make up card details. If data is missing, state that.
   - Be concise and helpful.
```

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
