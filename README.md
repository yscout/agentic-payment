# Machine-Native Payments for Autonomous AI Agents Using Smart Contracts

## Project Description

This project is an on-chain data marketplace where autonomous AI agents can pay for curated datasets using the [x402](https://docs.x402.org) payment protocol on Base Sepolia. It demonstrates a machine-native payment flow in which a consumer agent requests data, receives a `402 Payment Required` response, signs and submits payment, retries the request, and receives the purchased data without human approval for each transaction.

The consumer agent uses the purchased data to produce an **Investment Research Report** covering five target stocks: AAPL, TSLA, NVDA, GOOGL, and AMZN. To complete the report, the agent buys sentiment, financial, and weather data from the provider. Successful purchases can also be recorded on-chain through the `DataMarketplace` smart contract, creating a verifiable purchase history for provenance.

The system includes a real x402-enabled data provider, a mock data provider for development, an autonomous consumer agent, a smart contract for dataset registration and purchase logging, and a reporting pipeline that generates terminal and HTML outputs.

## Architecture

```text
Consumer Agent (agent/)             Data Provider (server/)          Base Sepolia
┌──────────────────┐              ┌──────────────────────┐        ┌──────────────────┐
│ ethers.js wallet │──POST──────> │ Express + x402       │        │ USDC token       │
│ x402 auto-pay    │<──402─────── │ paymentMiddleware    │        │ DataMarketplace  │
│ research plan    │──pay+retry──>│ dataset handlers     │──tx──> │ contract         │
│ report generator │<──data────── │ randomized data      │        │ (purchase logs)  │
└──────────────────┘              └──────────────────────┘        └──────────────────┘
```

## Components

| Component | Description |
|-----------|-------------|
| `contracts/` | Contains `DataMarketplace.sol`, the on-chain dataset registry and purchase provenance contract |
| `server/` | Express data provider with x402 payment middleware |
| `server/mock.ts` | Mock data provider with randomized responses for development |
| `agent/` | Autonomous consumer agent with x402 auto-pay |

## Team Contributions

| Team Member | Contribution |
|------------|--------------|
| Angie Hu | Built the `contracts/` component, including `DataMarketplace.sol`, the on-chain dataset registry and purchase provenance system |
| Yutao Mao | Built the `server/` component, including the Express data provider and x402 payment middleware |
| Tianliang Song | Built `server/mock.ts` and the `agent/` component, including the mock data provider, autonomous consumer agent, and x402 auto-pay flow |
| Xuechen Wang | Led integration work, including the demo script and generated report |

## Quick Start

```bash
npm install
cp .env.example .env

# Option 1: Demo mode (no server or wallet needed, simulated payments)
npm run agent:demo

# Option 2: Mock server + real agent (needs wallet with USDC)
npm run server:mock   # terminal 1
npm run agent         # terminal 2
```

## Agent Workflow

The autonomous consumer agent produces an investment research report by purchasing three categories of data:

| Dataset | Price per query | Purpose |
|---------|----------------|---------|
| Sentiment | $0.001 USDC | Market mood score (-1 to +1) per stock |
| Financial | $0.002 USDC | Earnings, revenue, analyst headlines |
| Weather | $0.0005 USDC | Conditions at major trading hubs (NYC, London, Tokyo) |

Total cost per run: **~$0.0165 USDC** for 13 data purchases.

## Setup

```bash
npm install
cp .env.example .env
```

## Fund the Agent Wallet

The agent needs USDC on Base Sepolia to pay for data.

### Option 1: Auto-generate wallet on first run

```bash
npm run agent

# Copy the printed wallet address, then fund it:
# ETH for gas: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
# USDC: https://faucet.circle.com/ (select Base Sepolia)

# Save the private key in .env as AGENT_PRIVATE_KEY
```

### Option 2: Use an existing funded wallet

```bash
# Set in .env:
AGENT_PRIVATE_KEY=0xYourPrivateKeyHere
```

## Run

```bash
# Demo mode: simulated payments, self-contained, no dependencies
npm run agent:demo

# Real mode: requires funded wallet + running data provider
npm run agent

# Real data provider: requires provider wallet + x402/server dependencies
npm run server

# Mock data provider: randomized responses for local testing
npm run server:mock
```

## Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_PRIVATE_KEY` | (auto-generate) | Agent wallet private key |
| `RPC_URL` | `https://sepolia.base.org` | Base Sepolia RPC |
| `SERVER_URL` | `http://localhost:4021` | Data provider URL |
| `DATA_MARKETPLACE_ADDRESS` | (empty) | Deployed `DataMarketplace` contract address |
| `PROVIDER_WALLET_ADDRESS` | (empty) | Provider wallet that receives x402 payments |
| `PROVIDER_PRIVATE_KEY` | (empty) | Owner/server wallet used to record purchases on-chain |
| `ENABLE_X402` | `true` | Set `false` only for local endpoint testing |
| `QUERY_INTERVAL_SECONDS` | `3` | Seconds between queries |
| `MAX_QUERIES` | `0` | Max queries (0 = unlimited) |

## Agent Files

| File | Purpose |
|------|---------|
| `agent/index.ts` | Main agent: wallet setup, x402 client, research plan execution, report generation |
| `agent/demo.ts` | Demo mode: same mission with simulated payments and mock data |
| `agent/config.ts` | Configuration from environment variables |
| `agent/queries.ts` | Research plan builder: 13 structured queries targeting 5 stocks and 3 cities |
| `agent/report.ts` | Terminal report: sentiment rankings table, financial highlights, recommendations |
| `agent/visualize.ts` | HTML report generator with Chart.js graphs, saved to `output/` |
| `agent/provenance.ts` | On-chain purchase history verification via DataMarketplace contract |
| `server/mock.ts` | Mock data provider: randomized sentiment, financial, and weather responses |

## Real Data Provider

The production server is implemented in `server/index.ts`. It gates the three data endpoints with x402, serves structured sentiment, financial, and weather data, and records successful purchases on the `DataMarketplace` contract when `DATA_MARKETPLACE_ADDRESS` and `PROVIDER_PRIVATE_KEY` are configured.

## What the Agent Does

1. **Wallet setup**: creates or loads an Ethereum wallet via ethers.js
2. **Research planning**: builds a 13-query plan targeting 5 stocks and 3 trading hubs
3. **Data purchasing**: executes each query, paying autonomously through the x402 flow: 402 response, sign, pay, retry
4. **Report generation**: produces a terminal report with sentiment rankings, financial highlights, and BUY/HOLD/SELL recommendations
5. **Visualization**: generates an interactive HTML report with Chart.js charts and saves it to `output/`
6. **Provenance verification**: checks purchase history on the DataMarketplace contract, if deployed

## Mock Data Provider

`server/mock.ts` simulates the data provider with randomized responses on each request:

- **Sentiment**: scores vary around realistic centers, such as NVDA bullish and TSLA volatile, with different summaries picked randomly
- **Financial**: multiple headline and summary variants per topic, with relevance scores jittered
- **Weather**: temperature, humidity, wind, and conditions randomized within city-specific ranges

Every demo run can produce a different research report with different recommendations.

## Example Output

```text
╔══════════════════════════════════════════════════════════════╗
║  AUTONOMOUS DATA CONSUMER AGENT                              ║
║  Mission: Produce investment research report                 ║
╚══════════════════════════════════════════════════════════════╝

[STEP 1] Setting up wallet... 0x5Fa5...cb6f
[STEP 2] Planning research... 13 queries ($0.0165 USDC)
[STEP 3] Purchasing data from provider...
  [1/13] Get market sentiment for AAPL ($0.001) -> OK
  [2/13] Get market sentiment for TSLA ($0.001) -> OK
  ...
  [13/13] Check conditions at Tokyo trading hub ($0.0005) -> OK

╔══════════════════════════════════════════════════════════════╗
║            INVESTMENT RESEARCH REPORT                        ║
╚══════════════════════════════════════════════════════════════╝

┌────────┬───────┬────────┬────────────────────────┬──────────┐
│ Ticker │ Score │ Signal │ Sentiment Bar          │ Rec.     │
├────────┼───────┼────────┼────────────────────────┼──────────┤
│ NVDA   │  0.94 │ bullish│ ████████████████████   │ BUY      │
│ AAPL   │  0.45 │ bullish│ ██████████████░░░░░░   │ BUY      │
│ AMZN   │  0.61 │ bullish│ ████████████████░░░░   │ BUY      │
│ GOOGL  │  0.22 │ bullish│ ████████████░░░░░░░░   │ HOLD     │
│ TSLA   │ -0.32 │ bearish│ ███████░░░░░░░░░░░░░   │ SELL     │
└────────┴───────┴────────┴────────────────────────┴──────────┘

BUY:  NVDA, AAPL, AMZN
HOLD: GOOGL
SELL: TSLA

Report saved to: output/report-1776131936939.html
```

The HTML report includes interactive Chart.js visualizations, including sentiment bar charts, a recommendation doughnut chart, and a full data summary.
