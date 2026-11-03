# Docs MCP + Chain MCP Agent — verified real Pharos composition

This is the permanent reviewer summary of the successful deployed Worker live test on **3 November 2026**.

- [Open live web app](https://docs-mcp-chain-mcp-agent.trantanlong2411.workers.dev/)
- [GitHub Actions passing test and downloadable full evidence](https://github.com/trantanlong2411-droid/Docs-MCP-Chain-MCP-Agent/actions/runs/41599646783)
- [Compact machine-readable verified run](./verified-run.json)
- [Agent flow and diagram](../README.md)
- [Source of strict docs-to-chain guard](../src/worker.mjs)

## Why this meets the task's four requirements

| Requirement | Verified evidence |
| --- | --- |
| Explanation sourced from Docs MCP | The agent connects to **Developer Docs MCP** at `docs.pharos.xyz/~gitbook/mcp`, invokes real `getPage`, validates the returned Solidity interface for the chosen function and includes the exact fetched official documentation URL. |
| Calls the same function on-chain using Chain MCP | Following documentation validation, the agent connects to official **Chain MCP** at `mcp.pharos.xyz/mcp`, checks chain 1672 and contract bytecode, and issues `eth_call` using the Keccak-derived selector for the very same documented function. |
| Interprets the result in context | Signed price feed value uses the documentation's 18 decimal places; timestamp returns a report-time integer and is explained with staleness caveats. |
| Two distinct functions | **latestAnswer()** and **latestTimestamp()** on the official PROS/USD oracle proxy, both demonstrated live, with independent on-chain responses. |

Official [Chainlink Push Engine Feeds documentation](https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe) specifically documents both functions, the returns `int256` and `uint256`, the PROS/USD proxy and the reported feed precision.

## Real live proof

| Function | Mainnet pinned block | Real eth_call result | Interpretation |
| --- | ---: | ---: | --- |
| `latestAnswer()` | 21996060 | `506807395438360200` | 0.5068073954383602 USD/PROS reported by the oracle (18 decimals) |
| `latestTimestamp()` | 21996066 | `1793692029` | Stored feed timestamp (Unix seconds), **not** transaction time |

Source: [live GitHub Actions logs](https://github.com/trantanlong2411-droid/Docs-MCP-Chain-MCP-Agent/actions/runs/41599646783), which verify one Docs MCP documentation fetch and an actual Chain MCP contract call for each of the two functions.

Each run produced seven ordered steps:

```
Single user request
  → Developer Docs MCP initialize
  → Developer Docs MCP getPage (verified source)
  → Chain MCP initialize
  → Chain MCP get_chain_info (1672)
  → Chain MCP get_code (contract present)
  → Chain MCP eth_call (same selector as docs)
  → Agent explains raw result and exports JSON
```

All **9/9 automated tests passed**; Cloudflare Worker build and both deployed MCP flow scenarios succeeded. GitHub Actions uploaded `pharos-docs-chain-mcp-agent-live-evidence` as full JSON (30-day retention). This summary remains in the public repository after the artifact expires.

## Important limitations

- **No transaction is sent**, only read-only `eth_call`; no tx hash exists.
- Chainlink self-managed price feeds are not guaranteed live. The Docs MCP page specifically warns users to inspect the observation timestamp and enforce a staleness threshold suitable for their application.
- The Docs MCP `askQuestion` and `searchDocumentation` were returning `Internal Server Error` on the initial verification day. The agent uses the independently working **getPage** tool and quotes only content actually returned from the official page. It does not fake a search answer.
- The original dynamic data in the full CI artifact was fetched from live Chain MCP; the static compact JSON is a summary of verified logs, not a substitute for MCP-generated receipts.

## Reviewer walkthrough

Open the live website. Choose `latestAnswer()`, click **Explain → Call → Interpret**, and inspect the documentation quote, source, on-chain raw answer and chain block. Then choose `latestTimestamp()` and repeat. Expand the full trace and export JSON proof. Each operation consists of a single browser request that invokes both official MCP servers sequentially.
