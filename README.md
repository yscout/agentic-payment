# Agentic Payment System

An AI agent that autonomously buys data from a provider, paying per-query in ETH.
Every purchase is recorded on-chain via a custom smart contract — wallet diff,
agent ledger, and on-chain audit trail all match to the wei.

## Quick start (zero config)

```bash
npm install
npm run demo:local
```

That's it. The script spins up a local Hardhat blockchain, deploys the
`DataMarketplace` contract, starts the data provider, and runs the consumer
agent end-to-end. No testnet ETH, no faucet, no manual setup. ~20 seconds.

You should see the agent buy 13 data points, then verify all 13 purchases on
the contract:

```
Total spent:                     0.00001650 ETH    (from agent's wallet)
Total spent (on-chain verified): 0.0000165 ETH     (from DataMarketplace)
```

## Tests

```bash
npm test       # 33 tests: contract (21) + server + provenance (12)
```

## What it does

The consumer agent has a research mission: produce a buy/hold/sell summary for
5 stocks. To do that, it needs sentiment, financial, and weather data — and
buys each one from a paid HTTP endpoint.

| Step | Who                | What happens                                                   |
| ---- | ------------------ | -------------------------------------------------------------- |
| 1    | Agent              | Sends ETH to the provider's wallet on-chain                    |
| 2    | Agent              | POSTs the request with `X-Payment-Tx: <txHash>` header         |
| 3    | Server             | Verifies the tx exists and paid enough                         |
| 4    | Server             | Serves the data and calls `DataMarketplace.recordPurchase(...)` |
| 5    | Agent (at the end) | Reads `getPurchasesByBuyer(self)` to verify the audit trail    |

Pricing (set in `server/pricing.ts`):

| Dataset   | Price          | What it returns                                |
| --------- | -------------- | ---------------------------------------------- |
| Sentiment | 0.000001 ETH   | Market mood score per ticker (-1 to +1)        |
| Financial | 0.000002 ETH   | Earnings headlines and analyst summaries       |
| Weather   | 0.0000005 ETH  | Conditions at major trading hubs               |

Full run = 13 queries ≈ 0.0000165 ETH (plus gas).

## Architecture

```
┌─────────────────────┐                ┌────────────────────────┐         ┌────────────────────┐
│ Consumer Agent      │   ETH tx       │ Data Provider          │   tx    │ Base Sepolia chain │
│ agent/index.ts      │ ─────────────► │ server/index.ts        │ ──────► │                    │
│                     │                │                        │         │ DataMarketplace    │
│ ethers wallet       │   POST + hash  │ verifies tx on-chain   │ record  │   .registerDataset │
│ ETH auto-pay        │ ─────────────► │ serves dataset         │ ──────► │   .recordPurchase  │
│ query loop          │                │                        │         │   (events)         │
│ on-chain verify     │   data JSON    │ records purchase       │         │                    │
│                     │ ◄───────────── │                        │         │                    │
└─────────────────────┘                └────────────────────────┘         └────────────────────┘
        │                                                                          ▲
        └──────────── getPurchasesByBuyer(self) ───────────────────────────────────┘
                       (audit trail: who bought what, when, for how much)
```

## Running on Base Sepolia testnet

For real on-chain activity visible on BaseScan, see [`docs/TESTNET.md`](docs/TESTNET.md).

## Repository layout

```
contracts/DataMarketplace.sol     on-chain dataset registry + purchase ledger
scripts/deploy.cjs                deploys the contract and registers 3 datasets
scripts/demo-local.sh             one-command local E2E demo
server/                           Express data provider + ETH payment middleware
agent/                            autonomous consumer agent
test/                             21 contract tests + 12 server tests
```

## Team

| Name           | Contribution                                                                  |
| -------------- | ----------------------------------------------------------------------------- |
| Angie Hu       | `DataMarketplace.sol` smart contract and Hardhat test suite                   |
| Yutao Mao      | Data provider server, ETH payment verification middleware, dataset handlers   |
| Tianliang Song | Consumer agent, query planning, on-chain verification, demo mode              |
| Xuechen Wang   | Integration, deployment scripts, end-to-end demo, report                      |

## Stack

Node.js · TypeScript · ethers.js v6 · Express · Hardhat · Solidity 0.8.20 · Base Sepolia
