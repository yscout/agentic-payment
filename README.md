# Agentic Payment System

An AI agent that autonomously buys market data using ETH payments on Base Sepolia, then generates an investment research report. No human approves any payment.

## What it does

The consumer agent has a mission: produce an investment research report for 5 stocks (AAPL, TSLA, NVDA, GOOGL, AMZN). To do this, it needs data it doesn't have — so it buys it from a data provider, query by query, paying in ETH each time. Every purchase is recorded on-chain via a custom smart contract.

## How payments work

Before each API request, the agent sends ETH to the provider wallet and includes the transaction hash in the request header (`X-Payment-Tx`). The server verifies the transaction on-chain before serving data.

| Dataset | Price | What it returns |
|---------|-------|-----------------|
| Sentiment | 0.000001 ETH | Market mood score per stock (-1 to +1) |
| Financial | 0.000002 ETH | Earnings headlines and analyst summaries |
| Weather | 0.0000005 ETH | Conditions at major trading hubs |

Total for a full run (13 queries): ~0.0000165 ETH

## Architecture

```
Consumer Agent              Data Provider              Base Sepolia
agent/index.ts              server/index.ts            DataMarketplace.sol

sends ETH tx    ──────────> verifies tx hash           records each
includes tx hash            serves data                purchase on-chain
generates report            records provenance
opens BaseScan
```

## Team

| Name | Contribution |
|------|-------------|
| Angie Hu | Smart contract (`DataMarketplace.sol`) — on-chain dataset registry and purchase provenance |
| Yutao Mao | Data provider server — Express API with ETH payment middleware |
| Tianliang Song | Consumer agent and mock data provider |
| Xuechen Wang | Integration, demo script, and report |

## Running it

```bash
npm install
cp .env.example .env
# fill in your keys (see below)
```

**Two terminals:**
```bash
npm run server   # terminal 1 — wait for "ETH payments: enabled"
npm run agent    # terminal 2
```

**Or just:**
```bash
npm run demo     # starts server + agent together, opens BaseScan at the end
```

**Demo mode (no wallet or server needed):**
```bash
npm run agent:demo
```

## Deploying the contract

```bash
npm run deploy   # deploys DataMarketplace to Base Sepolia, prints the address
```

Copy the printed address into `.env` as `DATA_MARKETPLACE_ADDRESS`.

## Environment variables

```bash
AGENT_PRIVATE_KEY=        # wallet that pays for data (needs ETH on Base Sepolia)
PROVIDER_WALLET_ADDRESS=  # provider wallet that receives ETH payments
PROVIDER_PRIVATE_KEY=     # signs recordPurchase() calls to the contract
DATA_MARKETPLACE_ADDRESS= # deployed DataMarketplace address

# Defaults are fine for Base Sepolia
RPC_URL=https://sepolia.base.org
SERVER_URL=http://localhost:4021
```

Get testnet ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

## Output

After a run, the agent prints a BUY/HOLD/SELL summary table and opens an HTML report with Chart.js visualizations. It also opens the DataMarketplace contract on BaseScan so you can see every purchase recorded on-chain.

## Stack

Node.js · TypeScript · ethers.js v6 · Express · Hardhat · Base Sepolia
