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

		// Tool: get-guides
		this.server.tool(
			"get-guides",
			{},
			async () => {
				console.log("Tool 'get-guides' called");
				const url = "https://fqrqqph16l.execute-api.us-west-2.amazonaws.com/guides";

				try {
					console.log(`Fetching from ${url}`);
					const response = await fetch(url, {
						headers: {
							Accept: "application/json",
						},
					});

					if (!response.ok) {
						console.error(`Error fetching guides: ${response.status} ${response.statusText}`);
						return {
							content: [
								{
									type: "text",
									text: `Error fetching guides: ${response.status} ${response.statusText}`,
								},
							],
							isError: true,
						};
					}

					const data = await response.json();
					console.log(`Successfully fetched guides`);

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
								text: `Failed to fetch guides: ${errorMessage}`,
							},
						],
						isError: true,
					};
				}
			}
		);

		// Tool: get-cards
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
				ids: z.string().optional().describe("Comma-separated list of card IDs"),
				bank: z.string().optional().describe("Filter by bank name"),
				category: z.string().optional().describe("Filter by category/rewards"),
				noFee: z.boolean().optional().describe("Filter for no-annual-fee cards"),
				persona: z
					.enum(["average", "student", "newcomer", "premium"])
					.optional()
					.describe("Target persona for tailored ranking (average, student, newcomer, premium)"),
			},
			async ({ sort, direction, ids, bank, category, noFee, persona }) => {
				console.log(
					`Tool 'get-cards' called with params: ${JSON.stringify({ sort, direction, ids, bank, category, noFee, persona })}`
				);
				const url = new URL(
					"https://fqrqqph16l.execute-api.us-west-2.amazonaws.com/cards",
				);

				if (sort) url.searchParams.set("sort", sort);
				if (direction) url.searchParams.set("direction", direction);
				if (ids) url.searchParams.set("ids", ids);
				if (bank) url.searchParams.set("bank", bank);
				if (category) url.searchParams.set("category", category);
				if (persona) url.searchParams.set("persona", persona);
				// The API expects boolean parameters as strings if they are query params like ?noFee=true
				if (noFee !== undefined) url.searchParams.set("noFee", String(noFee));

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

// Helper function to add keepalive pings to SSE stream
function addKeepAlivePings(response: Response, corsHeaders: Record<string, string>): Response {
	const contentType = response.headers.get("content-type") || "";

	// Only process SSE streams
	if (!contentType.includes("text/event-stream") || !response.body) {
		const newHeaders = new Headers(response.headers);
		for (const [key, value] of Object.entries(corsHeaders)) {
			if (!newHeaders.has(key)) {
				newHeaders.set(key, value);
			}
		}
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: newHeaders
		});
	}

	const reader = response.body.getReader();
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	let pingInterval: ReturnType<typeof setInterval> | null = null;
	let streamEnded = false;

	const stream = new ReadableStream({
		async start(controller) {
			// Send initial ping after a short delay
			pingInterval = setInterval(() => {
				if (!streamEnded) {
					try {
						controller.enqueue(encoder.encode("event: ping\ndata: ping\n\n"));
					} catch (e) {
						// Stream may have closed
						if (pingInterval) clearInterval(pingInterval);
					}
				}
			}, 15000); // Send ping every 15 seconds
		},
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					streamEnded = true;
					if (pingInterval) clearInterval(pingInterval);
					// Send a final ping before closing
					controller.enqueue(encoder.encode("event: ping\ndata: ping\n\n"));
					controller.close();
					return;
				}
				controller.enqueue(value);
			} catch (e) {
				streamEnded = true;
				if (pingInterval) clearInterval(pingInterval);
				controller.error(e);
			}
		},
		cancel() {
			streamEnded = true;
			if (pingInterval) clearInterval(pingInterval);
			reader.cancel();
		}
	});

	const newHeaders = new Headers(response.headers);
	for (const [key, value] of Object.entries(corsHeaders)) {
		if (!newHeaders.has(key)) {
			newHeaders.set(key, value);
		}
	}

	return new Response(stream, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders
	});
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		console.log(`Incoming request: ${request.method} ${url.pathname}`);

		// CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Accept, mcp-session-id, mcp-protocol-version",
			"Access-Control-Expose-Headers": "mcp-session-id",
			"Access-Control-Max-Age": "86400",
		};

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// Helper to add CORS headers and keepalive pings to response
		const addCorsAndPings = async (respPromise: Promise<Response>) => {
			const resp = await respPromise;
			return addKeepAlivePings(resp, corsHeaders);
		};

		// Handle /sse endpoint - supports both SSE (GET) and Streamable HTTP (POST)
		if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
			console.log(`Handling /sse request: ${request.method}`);

			// POST = Streamable HTTP transport (newer)
			// GET = SSE transport (older, still supported)
			if (request.method === "POST") {
				console.log("Using Streamable HTTP transport (POST)");
				return addCorsAndPings(MyMCP.serve("/sse").fetch(request, env, ctx));
			} else {
				console.log("Using SSE transport (GET)");
				return addCorsAndPings(MyMCP.serveSSE("/sse").fetch(request, env, ctx));
			}
		}

		// Handle /mcp endpoint - Streamable HTTP only
		if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
			console.log("Handling /mcp request");
			return addCorsAndPings(MyMCP.serve("/mcp").fetch(request, env, ctx));
		}

		console.warn(`404 Not Found: ${url.pathname}`);
		return new Response("Not found", { status: 404, headers: corsHeaders });
	},
};
