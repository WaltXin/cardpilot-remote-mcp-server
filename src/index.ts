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
					const response = await fetch(url.toString(), {
						headers: {
							Accept: "application/json",
						},
					});

					if (!response.ok) {
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

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
