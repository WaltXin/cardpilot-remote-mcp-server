#!/usr/bin/env python3
"""
Test script for CardPilot MCP Server with OpenAI Responses API.

This script tests if your MCP server works with OpenAI's programmatic API.
If this works but Agent Builder doesn't, then Agent Builder has a bug.

Prerequisites:
1. Install OpenAI SDK: pip install openai
2. Set your API key: export OPENAI_API_KEY="your-key-here"

Usage:
    python test_openai_mcp.py
"""

from openai import OpenAI

def test_mcp_server():
    client = OpenAI()
    
    # Test local Ngrok tunnel
    ngrok_url = "https://e31ef5d9bbbc.ngrok-free.app/mcp"
    print(f"Testing Local via Ngrok: {ngrok_url}")
    print("-" * 60)
    
    try:
        resp = client.responses.create(
            model="gpt-4o",
            tools=[
                {
                    "type": "mcp",
                    "server_label": "cardpilot_local",
                    "server_description": "CardPilot Local Test",
                    # "server_url": "https://cardpilot-remote-mcp-server.mcps.workers.dev/mcp",
                    "server_url": ngrok_url,
                    "require_approval": "never",
                },
            ],
            input="What are the top 3 recommended credit cards? Use the get-cards tool.",
        )
        
        print("\n✅ Ngrok Tunnel SUCCESS!")
        print("-" * 60)

        print(resp.output_text)
        
        # Print details about MCP tool calls if any
        print("\n" + "-" * 60)
        print("Response details:")
        for item in resp.output:
            if hasattr(item, 'type'):
                print(f"  - {item.type}")
                if item.type == "mcp_list_tools":
                    print(f"    Tools found: {[t.name for t in item.tools]}")
                elif item.type == "mcp_call":
                    print(f"    Tool called: {item.name}")
                    print(f"    Arguments: {item.arguments}")
                    if item.error:
                        print(f"    Error: {item.error}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        print("\nPossible issues:")
        print("  1. OPENAI_API_KEY not set")
        print("  2. Your OpenAI account may not have access to the Responses API")
        print("  3. The MCP server may be unreachable")
        raise

if __name__ == "__main__":
    test_mcp_server()
