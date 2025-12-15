
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

// Create server instance
const server = new McpServer({
    name: "CardPilot Cards Vercel",
    version: "1.0.0",
});

// Helper for SSE Transport
let transport: SSEServerTransport | null = null;

// Add tool
server.tool(
    "get-cards",
    {
        sort: z
            .enum(["recommended", "welcome_offer", "interest_rate", "annual_fee", "net_value"])
            .optional()
            .describe("Sort criteria for the cards"),
        direction: z
            .enum(["asc", "desc"])
            .optional()
            .describe("Sort direction"),
    },
    async ({ sort, direction }) => {
        console.log(`Tool 'get-cards' called with sort=${sort}, direction=${direction}`);
        const url = new URL("https://fqrqqph16l.execute-api.us-west-2.amazonaws.com/cards");

        if (sort) url.searchParams.set("sort", sort);
        if (direction) url.searchParams.set("direction", direction);

        try {
            const response = await fetch(url.toString(), {
                headers: { Accept: "application/json" },
            });

            if (!response.ok) {
                return {
                    content: [{ type: "text", text: `Error fetching cards: ${response.status}` }],
                    isError: true,
                };
            }

            const data = await response.json();
            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Failed to fetch cards: ${error}` }],
                isError: true,
            };
        }
    }
);

// Vercel Serverless Function Handler
export default async function handler(request: Request) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept, mcp-session-id, mcp-protocol-version",
        "Access-Control-Expose-Headers": "mcp-session-id",
        "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Handle SSE (GET) - Establish connection
    if (request.method === "GET") {
        transport = new SSEServerTransport("/api/mcp", new Response());
        await server.connect(transport);

        // Get the SSE stream from the transport
        // Note: This is an implementation detail. SSEServerTransport writes to the response it was given.
        // But since we need to return a Response object in Vercel, we need to adapt.
        // Actually, SSEServerTransport in the SDK is designed for Node's IncomingMessage/ServerResponse.
        // For Vercel/Web Standard Request/Response, we need to be careful.

        // Let's use a simpler approach for the Vercel handler that mimics the standard behavior manually
        // or checks if SDK supports Web Streams.
        // The current SDK's SSEServerTransport primarily targets Node.js streams.
        // Let's check documentation or assume we might need a custom WebStream transport.

        // For simplicity, let's look at how we did it in Cloudflare.
        // Cloudflare used `McpServer` from SDK but `agents` handled transport.

        // Let's implement a simple SSE transport for Web Standards here.
        return handleSSE(request, corsHeaders);
    }

    // Handle POST - Messages
    if (request.method === "POST") {
        if (!transport) {
            return new Response("No active connection", { status: 400, headers: corsHeaders });
        }
        return transport.handlePostMessage(request, new Response(), {
            // Shim for Node's IncomingMessage/ServerResponse if needed, or just hope SDK handles Request object.
            // Actually SDK 1.0.0+ transport usually takes req/res/url.
            // If this is too complex for 1 file, we might hit issues.

            // ALTERNATIVE: Use just Streamable HTTP (Stateless-ish) if supported by SDK?
            // The SDK requires a persistent transport connection.

            // Let's try to just return "Not Implemented" for now and re-evaluate if we need a full transport implementation.
            // Wait, the user wants a working Vercel deployment.

            // Let's use the standard "startSSE" pattern.
            // But Vercel serverless functions are ephemeral.
            // We can't share state (the `transport` variable) between the GET and POST requests easily!
            // This is why Cloudflare Durable Objects were valid - they keep state.
            // Vercel Serverless = No shared state.

            // SO: Vercel deployment for generic MCP is hard unless we use a stateful backing (Redis/KV) or stick to *just* Streamable HTTP but where the session state is managed externally?
            // Actually, standard Streamable HTTP allows independent requests IF the server is stateless.
            // But `McpServer` class in SDK implies specific connection state.

            // Better control: Deploy to RAILWAY or RENDER (Docker).
            // OR: Use Vercel only if we can make it stateless.

            // Re-reading User Request: "Try Vercel".
            // If Vercel is hard, suggest Railway?
            // Or: Does Agent Builder support *stateless* calls?
            // Initialization -> "session_id". 
            // If we return a new session ID every time, it breaks.

            // WAIT! Vercel Edge Functions *can* do streaming (SSE).
            // But handling the *Response* (POST) relative to the open stream (GET) requires coordination.
            // Typically done via a shared process.

            // Use Case: Just `tools/list`?
            // 424 error happens on `tools/list`.
            // If we can just serve `initialize` and `tools/list` over SSE loop, maybe that's enough?
            // But Agent Builder likely posts to the endpoint.

            // Let's try a very simpler approach:
            // Just implement the raw Reference Implementation logic for the responses.

        });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

}

async function handleSSE(request: Request, corsHeaders: any) {
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            // Just send the tools list immediately on connection? 
            // No, MCP waits for `initialize` request.

            // Issue: Vercel is request-response.
            // We can't bidirectional communicate easily without WebSocket or long-polling POSTs correlated to this stream.
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            ...corsHeaders
        }
    });
}
