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
    ngrok_url = "https://232223f5e5e4.ngrok-free.app/mcp"
    print(f"Testing Local via Ngrok: {ngrok_url}")
    print("-" * 60)
    
    # Updated test questions based on new tool capabilities
    test_questions = [
        "What are the top 3 recommended credit cards?",
        "I'm new to credit cards. Should I get cash back or points?",
        "Show me all the cash back cards available.",
        "I'm looking for a travel card from TD.",
        "Do you have any recommendations for cards with no annual fee?",
        "Can you give me the details for the TD Aeroplan Visa Infinite Card?",
        "What is the best rated card for groceries that doesn't cost anything to hold?"  
    ]

    for question in test_questions:
        print(f"\n❓ Question: {question}")
        print("-" * 60)
        try:
            resp = client.responses.create(
                model="gpt-4o",
                tools=[
                    {
                        "type": "mcp",
                        "server_label": "cardpilot_local",
                        "server_description": "CardPilot Local Test",
                        "server_url": ngrok_url,
                        "require_approval": "never",
                    },
                ],
                input=question,
            )
            
            print(resp.output_text)
            
            # Print details about MCP tool calls if any
            # print("\n" + "-" * 20)
            # print("Response details:")
            for item in resp.output:
                if hasattr(item, 'type'):
                    # print(f"  - {item.type}")
                    if item.type == "mcp_call":
                        print(f"    🛠️ Tool called: {item.name}")
                        print(f"    Arguments: {item.arguments}")
                        if item.error:
                            print(f"    Error: {item.error}")
            
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            
    print("\n✅ Verification Complete!")

if __name__ == "__main__":
    test_mcp_server()
