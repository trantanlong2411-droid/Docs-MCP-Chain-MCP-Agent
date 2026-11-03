---
name: pharos-docs-chain-agent
description: Compose Pharos Developer Docs MCP and Pharos Chain MCP in a single read-only agent flow. Explain two ERC20 contract functions with actual documentation sources before calling that exact function on mainnet.
---
# Docs MCP + Chain MCP Agent

The Cloudflare Worker executes one request containing a supported ERC-20 function (`balanceOf(address)` or `totalSupply()`) and a public wallet address.

1. Connect to the official Pharos Developer Docs MCP; discover tools and ask for a source-backed explanation of the selected function. If no relevant explanation with actual `docs.pharos.xyz` URLs is found, stop. Never invent citations.
2. Start a separate Pharos Chain MCP session (mainnet 1672), confirm network and latest block, and check contract bytecode.
3. Only after the Docs step succeeds, encode the selected function's exact canonical ERC-20 calldata and use Chain MCP `eth_call` at the pinned block. Do not send or sign any transaction.
4. Decode the uint256 view result in smallest token units, relate it to the documentation, and retain the source references.
5. Produce a seven-step trace that proves Docs MCP and Chain MCP were used sequentially, not side by side. Include inputs, outputs, source URLs, matching function signatures and block number.
6. Repeat for both supported functions and export the full JSON proof.

This is a read-only explanation-and-inspection tool, not a transfer agent. A missing Docs MCP answer, incorrect network or missing contract bytecode fails closed; no synthetic success fallback.
