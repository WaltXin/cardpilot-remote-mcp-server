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

// AIDesign API Base URL
const AIDESIGN_API_BASE = "https://ywe5uwfa7a.execute-api.us-west-2.amazonaws.com";

// AIDesign MCP - Image processing tools
export class AIDesignMCP extends McpAgent {
	server = new McpServer({
		name: "AIDesign Image Tools",
		version: "1.0.0",
	});

	async init() {
		console.log("Initializing AIDesignMCP agent...");

		// Tool: get-upload-url
		this.server.tool(
			"get-upload-url",
			{
				fileType: z
					.string()
					.describe("MIME type of the file to upload (e.g., 'image/jpeg', 'image/png')"),
			},
			async ({ fileType }) => {
				console.log(`Tool 'get-upload-url' called with fileType: ${fileType}`);
				const url = `${AIDESIGN_API_BASE}/upload-url`;

				try {
					const response = await fetch(url, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify({ fileType }),
					});

					if (!response.ok) {
						console.error(`Error getting upload URL: ${response.status} ${response.statusText}`);
						return {
							content: [{ type: "text", text: `Error: ${response.status} ${response.statusText}` }],
							isError: true,
						};
					}

					const data = await response.json();
					console.log("Successfully got upload URL");
					return {
						content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error(`Fetch exception: ${errorMessage}`);
					return {
						content: [{ type: "text", text: `Failed to get upload URL: ${errorMessage}` }],
						isError: true,
					};
				}
			}
		);

		// Tool: process-image
		this.server.tool(
			"process-image",
			{
				imageKey: z
					.string()
					.describe("S3 key of the uploaded image (returned from get-upload-url)"),
				prompt: z
					.string()
					.describe("Instructions for how to process the image with AI"),
			},
			async ({ imageKey, prompt }) => {
				console.log(`Tool 'process-image' called with imageKey: ${imageKey}`);
				const url = `${AIDESIGN_API_BASE}/process`;

				try {
					const response = await fetch(url, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify({ imageKey, prompt }),
					});

					if (!response.ok) {
						console.error(`Error processing image: ${response.status} ${response.statusText}`);
						return {
							content: [{ type: "text", text: `Error: ${response.status} ${response.statusText}` }],
							isError: true,
						};
					}

					const data = await response.json();
					console.log("Successfully processed image");
					return {
						content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error(`Fetch exception: ${errorMessage}`);
					return {
						content: [{ type: "text", text: `Failed to process image: ${errorMessage}` }],
						isError: true,
					};
				}
			}
		);

		// Tool: list-products
		this.server.tool(
			"list-products",
			{
				category: z
					.string()
					.optional()
					.describe("Filter products by category (e.g., 'rings', 'necklaces')"),
			},
			async ({ category }) => {
				console.log(`Tool 'list-products' called with category: ${category}`);
				const url = new URL(`${AIDESIGN_API_BASE}/product`);
				if (category) url.searchParams.set("category", category);

				try {
					const response = await fetch(url.toString(), {
						headers: { Accept: "application/json" },
					});

					if (!response.ok) {
						console.error(`Error listing products: ${response.status} ${response.statusText}`);
						return {
							content: [{ type: "text", text: `Error: ${response.status} ${response.statusText}` }],
							isError: true,
						};
					}

					const data = await response.json();
					console.log("Successfully listed products");
					return {
						content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error(`Fetch exception: ${errorMessage}`);
					return {
						content: [{ type: "text", text: `Failed to list products: ${errorMessage}` }],
						isError: true,
					};
				}
			}
		);

		// Tool: process-image-direct - Simplified single-step image processing
		// Accepts either base64 or a public URL, handles upload internally
		this.server.tool(
			"process-image-direct",
			{
				imageBase64: z
					.string()
					.optional()
					.describe("Base64-encoded image data (without data URI prefix). Use this when user attaches an image."),
				imageUrl: z
					.string()
					.optional()
					.describe("Public URL of an image to process. Use this when user provides a link."),
				prompt: z
					.string()
					.describe("Instructions for how to process/transform the image with AI (e.g., 'Make it look professional', 'Remove the background')"),
			},
			async ({ imageBase64, imageUrl, prompt }) => {
				console.log(`Tool 'process-image-direct' called with prompt: ${prompt?.substring(0, 50)}...`);

				// Validate that at least one image source is provided
				if (!imageBase64 && !imageUrl) {
					return {
						content: [{ type: "text", text: "Error: Please provide either imageBase64 or imageUrl" }],
						isError: true,
					};
				}

				try {
					// Step 1: If URL provided, fetch the image and convert to base64
					let base64Data = imageBase64;
					let mimeType = "image/png"; // default

					if (imageUrl && !imageBase64) {
						console.log(`Fetching image from URL: ${imageUrl}`);
						const imageResponse = await fetch(imageUrl);
						if (!imageResponse.ok) {
							return {
								content: [{ type: "text", text: `Error fetching image from URL: ${imageResponse.status}` }],
								isError: true,
							};
						}
						const contentType = imageResponse.headers.get("content-type");
						if (contentType) mimeType = contentType;
						const arrayBuffer = await imageResponse.arrayBuffer();
						const uint8Array = new Uint8Array(arrayBuffer);
						// Convert to base64 in Cloudflare Workers
						base64Data = btoa(String.fromCharCode(...uint8Array));
					}

					// Step 2: Get upload URL from backend
					console.log("Getting upload URL from backend...");
					const uploadUrlResponse = await fetch(`${AIDESIGN_API_BASE}/upload-url`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify({ fileType: mimeType }),
					});

					if (!uploadUrlResponse.ok) {
						return {
							content: [{ type: "text", text: `Error getting upload URL: ${uploadUrlResponse.status}` }],
							isError: true,
						};
					}

					const { uploadUrl, imageKey } = (await uploadUrlResponse.json()) as { uploadUrl: string; imageKey: string };
					console.log(`Got upload URL, imageKey: ${imageKey}`);

					// Step 3: Upload the image to S3
					console.log("Uploading image to S3...");
					const binaryData = Uint8Array.from(atob(base64Data!), c => c.charCodeAt(0));
					const uploadResponse = await fetch(uploadUrl, {
						method: "PUT",
						headers: {
							"Content-Type": mimeType,
						},
						body: binaryData,
					});

					if (!uploadResponse.ok) {
						const errorText = await uploadResponse.text();
						console.error(`S3 upload failed: ${uploadResponse.status} - ${errorText}`);
						return {
							content: [{ type: "text", text: `Error uploading to S3: ${uploadResponse.status}` }],
							isError: true,
						};
					}
					console.log("Image uploaded successfully");

					// Step 4: Process the image with Gemini
					console.log("Processing image with Gemini...");
					const processResponse = await fetch(`${AIDESIGN_API_BASE}/process`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify({ imageKey, prompt }),
					});

					if (!processResponse.ok) {
						return {
							content: [{ type: "text", text: `Error processing image: ${processResponse.status}` }],
							isError: true,
						};
					}

					const result = await processResponse.json();
					console.log("Image processed successfully");
					return {
						content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error(`process-image-direct exception: ${errorMessage}`);
					return {
						content: [{ type: "text", text: `Failed to process image: ${errorMessage}` }],
						isError: true,
					};
				}
			}
		);
	}
}

// CardPilot MCP - Credit card tools
export class CardPilotMCP extends McpAgent {
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
				limit: z.number().optional().describe("Maximum number of cards to return (default: 5)"),
			},
			async ({ sort, direction, ids, bank, category, noFee, persona, limit }) => {
				console.log(
					`Tool 'get-cards' called with params: ${JSON.stringify({ sort, direction, ids, bank, category, noFee, persona, limit })}`
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
				if (limit) url.searchParams.set("limit", String(limit));
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

					if (limit && data.cards.length > limit) {
						data.cards = data.cards.slice(0, limit);
						console.log(`Truncated to ${data.cards.length} cards due to limit`);
					}

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
				return addCorsAndPings(CardPilotMCP.serve("/sse").fetch(request, env, ctx));
			} else {
				console.log("Using SSE transport (GET)");
				return addCorsAndPings(CardPilotMCP.serveSSE("/sse").fetch(request, env, ctx));
			}
		}

		// Handle /mcp endpoint - Streamable HTTP only (CardPilot)
		if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
			console.log("Handling /mcp request");
			return addCorsAndPings(CardPilotMCP.serve("/mcp").fetch(request, env, ctx));
		}

		// Handle /other endpoint - AIDesign tools
		if (url.pathname === "/other" || url.pathname.startsWith("/other/")) {
			console.log(`Handling /other request: ${request.method}`);

			if (request.method === "POST") {
				console.log("Using Streamable HTTP transport (POST) for AIDesign");
				return addCorsAndPings(AIDesignMCP.serve("/other", { binding: "AIDESIGN_MCP_OBJECT" }).fetch(request, env, ctx));
			} else {
				console.log("Using SSE transport (GET) for AIDesign");
				return addCorsAndPings(AIDesignMCP.serveSSE("/other", { binding: "AIDESIGN_MCP_OBJECT" }).fetch(request, env, ctx));
			}
		}

		console.warn(`404 Not Found: ${url.pathname}`);
		return new Response("Not found", { status: 404, headers: corsHeaders });
	},
};
