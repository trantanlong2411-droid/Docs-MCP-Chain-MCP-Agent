---
name: pharos-docs-chain-mcp-agent
description: Fetch Pharos Chainlink Push Engine Feeds docs through the official Developer Docs MCP and call the exact documented latestAnswer() or latestTimestamp() function through the official Chain MCP. Safe, read-only.
---
# Docs + Chain MCP Agent

1. User selects `latestAnswer()` (int256) or `latestTimestamp()` (uint256) on the official PROS/USD feed proxy at `0x371Ed36aEe5bFFbED1A2aa9b7deD7F4EB30F5466`.
2. Initialize Pharos Developer Docs MCP at `https://docs.pharos.xyz/~gitbook/mcp`, discover `getPage`, and request `https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe`.
3. Validate the actual returned page explicitly lists the selected Solidity function, its return type, 18 decimals and the mainnet proxy address. If documentation is absent or irrelevant, stop. Do not fabricate sources.
4. In a separate real Chain MCP session, verify chain 1672, get the latest block and code, and perform a pinned `eth_call` with the selected Keccak-derived ABI selector.
5. Decode the return value (signed int256 for price, uint256 for feed timestamp) and explain it using the documentation. This is a feed observation, not a guaranteed tradable price.
6. Export a seven-step JSON trace showing Docs before Chain and the matching selected function plus source URL.

All operations are read-only; no private key, transfer, transaction broadcast or fee. This is not a trade/valuation recommendation.
