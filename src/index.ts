import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

interface CardDetails {
	rewards: number;
	perks: number;
	fees: number;
}

interface Card {
	cardId: string;
	name: string;
	bank: string;
	annualFee: number;
	score: number;
	details: CardDetails;
	[key: string]: unknown;
}

interface CardResponse {
	cards: Card[];
	meta: {
		total: number;
		sort: string;
		direction: string;
	};
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "CardPilot Cards",
		version: "1.0.0",
	});

	async init() {
		console.log("Initializing MyMCP agent...");
		this.server.tool(
			"get-cards",
			{
				sort: z
					.enum([
						"recommended",
						"welcome_offer",
						"interest_rate",
						"annual_fee",
						"net_value",
					])
					.optional()
					.describe("Sort criteria for the cards"),
				direction: z
					.enum(["asc", "desc"])
					.optional()
					.describe("Sort direction"),
			},
			async ({ sort, direction }) => {
				console.log(`Tool 'get-cards' called with sort=${sort}, direction=${direction}`);
				const url = new URL(
					"https://fqrqqph16l.execute-api.us-west-2.amazonaws.com/cards",
				);

				if (sort) {
					url.searchParams.set("sort", sort);
				}
				if (direction) {
					url.searchParams.set("direction", direction);
				}

				try {
					console.log(`Fetching from ${url.toString()}`);
					const response = await fetch(url.toString(), {
						headers: {
							Accept: "application/json",
						},
					});

					if (!response.ok) {
						console.error(`Error fetching cards: ${response.status} ${response.statusText}`);
						return {
							content: [
								{
									type: "text",
									text: `Error fetching cards: ${response.status} ${response.statusText}`,
								},
							],
							isError: true,
						};
					}

					const data = (await response.json()) as CardResponse;
					console.log(`Successfully fetched ${data.cards.length} cards`);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(data, null, 2),
							},
						],
					};
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					console.error(`Fetch exception: ${errorMessage}`);
					return {
						content: [
							{
								type: "text",
								text: `Failed to fetch cards: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			},
		);
	}
}


export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		console.log(`Incoming request: ${request.method} ${url.pathname}`);

		// CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "*",
			"Access-Control-Max-Age": "86400",
		};

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			console.log("Handling SSE request");
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx).then(resp => {
				// Determine if we need to wrap the response to add CORS headers
				// The SDK might add them, but let's ensure they are present.
				const newHeaders = new Headers(resp.headers);
				for (const [key, value] of Object.entries(corsHeaders)) {
					if (!newHeaders.has(key)) {
						newHeaders.set(key, value);
					}
				}
				return new Response(resp.body, {
					status: resp.status,
					statusText: resp.statusText,
					headers: newHeaders
				});
			});
		}

		if (url.pathname === "/mcp") {
			console.log("Handling /mcp request");
			return MyMCP.serve("/mcp").fetch(request, env, ctx).then(resp => {
				const newHeaders = new Headers(resp.headers);
				for (const [key, value] of Object.entries(corsHeaders)) {
					if (!newHeaders.has(key)) {
						newHeaders.set(key, value);
					}
				}
				return new Response(resp.body, {
					status: resp.status,
					statusText: resp.statusText,
					headers: newHeaders
				});
			});
		}

		console.warn(`404 Not Found: ${url.pathname}`);
		return new Response("Not found", { status: 404, headers: corsHeaders });
	},
};
