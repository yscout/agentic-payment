# Agentic Payment System -- Full Team Execution Plan

## Status

| Person       | Role                 | Status                      |
| ------------ | -------------------- | --------------------------- |
| Person A     | Smart Contract       | NOT STARTED                 |
| Person B     | Data Provider Server | NOT STARTED                 |
| **Person C** | **Consumer Agent**   | **DONE** (code in `agent/`) |
| Person D     | Integration + Report | NOT STARTED                 |

Person C's code is complete and defines the interfaces that Person A and B must match. See "Interface Contracts" below.

---

## The Scenario: On-Chain Data Marketplace

A "Data Consumer" AI agent needs curated market data to make decisions. It discovers a "Data Provider" agent that sells processed datasets (financial sentiment, news summaries, weather analytics). The consumer agent autonomously creates a wallet, funds it with USDC, and buys data query-by-query. Payment is handled by the x402 protocol (the industry standard). Every purchase is also recorded on-chain via a custom DataMarketplace contract, creating a provenance trail.

No human approves any payment. When funds run out, the agent stops.

---

## Architecture

```
Consumer Agent (agent/)          Data Provider (server/)          Base Sepolia
+--------------------+          +------------------------+       +-------------------+
| ethers.js wallet   |--POST--> | Express + x402         |       | USDC token        |
| x402 auto-pay      |<--402--- | paymentMiddleware      |       | DataMarketplace   |
| query loop         |--pay+--> | dataset handlers       |--tx-->| contract          |
| balance monitor    |<--data-- | provenance recording   |       | (purchase logs)   |
+--------------------+          +------------------------+       +-------------------+
```

We use **x402** (Coinbase, 161M+ transactions, backed by Google/Cloudflare/Visa) for payment settlement. Our custom smart contract handles what x402 does not: **who bought what data, when, and for how much** -- on-chain provenance.

---

## Locked Decisions

- **Chain:** Base Sepolia (testnet, chain ID 84532)
- **Payment protocol:** x402 (`@x402/express` for server, `@x402/fetch` + `@x402/evm` for agent)
- **Token:** USDC on Base Sepolia (address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
- **Wallet:** Raw ethers.js -- no external API key dependency
- **Pricing:** sentiment $0.001, financial $0.002, weather $0.0005
- **Stack:** Node.js + TypeScript, Hardhat, ethers.js v6, Express

---

## Interface Contracts (CRITICAL -- everyone must match these)

Person C's agent code is already written. Person A and B **must** match these exact interfaces or the system won't connect.

### API Endpoints (Person B must implement)

The agent POSTs to these three endpoints:

```
POST /api/data/sentiment
POST /api/data/financial
POST /api/data/weather
```

Request body:

```json
{ "query": "AAPL" }
```

Success response (200):

```json
{
  "ticker": "AAPL",
  "score": 0.72,
  "signal": "bullish",
  "confidence": 0.85,
  "sources": 15,
  "summary": "Market sentiment for AAPL based on 15 sources."
}
```

Error responses:

- `402` -- x402 middleware handles this automatically (no payment attached)
- `400` -- invalid query
- `500` -- server error

The server must run on port **4021** by default (configurable via SERVER_URL in .env).

### Smart Contract ABI (Person A must implement)

The agent's `agent/provenance.ts` calls these view functions after the run:

```solidity
function getPurchasesByBuyer(address buyer) external view returns (uint256[]);

function getPurchase(uint256 id) external view returns (
    address buyer,
    uint256 datasetId,
    uint256 pricePaid,
    bytes32 queryHash,
    uint256 timestamp
);

function getDataset(uint256 id) external view returns (
    string name,
    string description,
    uint256 priceUsd,
    bool active
);

function getDatasetCount() external view returns (uint256);
function getTotalPurchases() external view returns (uint256);
```

The server (Person B) calls these write functions:

```solidity
function registerDataset(string calldata name, string calldata description, uint256 priceUsd) external;  // onlyOwner
function recordPurchase(address buyer, uint256 datasetId, uint256 pricePaid, bytes32 queryHash) external;  // onlyOwner
```

Events:

```solidity
event DatasetRegistered(uint256 indexed id, string name, uint256 priceUsd);
event PurchaseRecorded(uint256 indexed purchaseId, address indexed buyer, uint256 indexed datasetId);
```

### Dataset IDs (everyone must agree)

After deploy, Person A registers 3 datasets in this order:

| ID  | Name        | Price (micro-USD) |
| --- | ----------- | ----------------- |
| 0   | `sentiment` | 1000 ($0.001)     |
| 1   | `financial` | 2000 ($0.002)     |
| 2   | `weather`   | 500 ($0.0005)     |

---

## Repository Structure

```
agentic-payment/
  contracts/                     # Person A
    DataMarketplace.sol
  scripts/                       # Person A
    deploy.ts
  test/                          # Person A
    DataMarketplace.test.ts
  server/                        # Person B
    index.ts                     # Express + x402 middleware
    datasets.ts                  # Dataset handlers
    provenance.ts                # On-chain purchase recording
    mock.ts                      # Mock data provider (Person C, for local testing)
  agent/                         # Person C (DONE)
    index.ts                     # Main agent
    config.ts                    # Configuration
    queries.ts                   # Research plan builder
    report.ts                    # Terminal report generator
    visualize.ts                 # HTML report with Chart.js
    provenance.ts                # On-chain verification
    demo.ts                      # Demo mode (simulated)
  output/                        # Generated HTML reports (gitignored)
  hardhat.config.ts              # Person A
  package.json                   # Shared (already set up)
  tsconfig.json                  # Shared (already set up)
  .env.example                   # Shared (already set up)
  .gitignore                     # Shared (already set up)
  README.md                      # Person D
  PLAN.md                        # This file
```

---

## Person A -- Smart Contract Engineer

### What to build

A single Solidity contract: `DataMarketplace.sol`. It does NOT handle payments (x402 does that). It records what was purchased on-chain for provenance and audit.

### Step-by-step

**Step 1: Set up Hardhat**

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
npx hardhat init  # Choose TypeScript project
```

Configure `hardhat.config.ts` for Base Sepolia:

```typescript
networks: {
  "base-sepolia": {
    url: "https://sepolia.base.org",
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    chainId: 84532,
  }
}
```

**Step 2: Write `contracts/DataMarketplace.sol`**

Storage:

```solidity
address public owner;
Dataset[] public datasets;
Purchase[] public purchases;
mapping(address => uint256[]) public purchasesByBuyer;
```

Functions -- must match the ABI defined in "Interface Contracts" above. Key points:

- `registerDataset` and `recordPurchase` are `onlyOwner` (the server wallet)
- `recordPurchase` pushes to `purchases` array, pushes the ID to `purchasesByBuyer[buyer]`, emits `PurchaseRecorded`
- `timestamp` should use `block.timestamp`

**Step 3: Write tests (`test/DataMarketplace.test.ts`)**

Test cases:

- Register 3 datasets, verify metadata via `getDataset()`
- Record a purchase, verify via `getPurchase()` and `getPurchasesByBuyer()`
- Record multiple purchases from same buyer
- `onlyOwner` reverts for non-owner callers
- Invalid dataset ID handling

**Step 4: Deploy to Base Sepolia**

Write `scripts/deploy.ts`:

1. Deploy DataMarketplace
2. Call `registerDataset("sentiment", "Market sentiment analysis", 1000)`
3. Call `registerDataset("financial", "Financial news summary", 2000)`
4. Call `registerDataset("weather", "Weather forecast data", 500)`
5. Print contract address

```bash
npx hardhat run scripts/deploy.ts --network base-sepolia
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS>
```

**Step 5: Share with team**

After deploy, share:

- Contract address (everyone puts this in `.env` as `DATA_MARKETPLACE_ADDRESS`)
- Deployer wallet address (Person B needs this -- it's the `owner` that can call `recordPurchase`)

### Timeline: Week 1

### Dependencies: None. Can start immediately.

---

## Person B -- Data Provider Server

### What to build

An Express.js server that:

1. Gates 3 data endpoints behind x402 payment middleware
2. Serves data (LLM-enriched or mock)
3. Records each purchase on the DataMarketplace contract

### Step-by-step

**Step 1: Install server dependencies**

```bash
npm install express @x402/express
npm install --save-dev @types/express
```

**Step 2: Write `server/index.ts`**

```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";

const app = express();
app.use(express.json());

// x402 payment wall -- agent must pay USDC to access these endpoints
app.use(paymentMiddleware({
  payTo: process.env.PROVIDER_WALLET_ADDRESS,
  routes: {
    "POST /api/data/sentiment": { price: "$0.001", chain: "base-sepolia" },
    "POST /api/data/financial": { price: "$0.002", chain: "base-sepolia" },
    "POST /api/data/weather":   { price: "$0.0005", chain: "base-sepolia" },
  }
}));

// Route handlers (see datasets.ts)
app.post("/api/data/sentiment", handleSentiment);
app.post("/api/data/financial", handleFinancial);
app.post("/api/data/weather",   handleWeather);

app.listen(4021, () => console.log("Data provider running on :4021"));
```

**Step 3: Write `server/datasets.ts`**

Each handler:

- Reads `req.body.query`
- If `OPENAI_API_KEY` is set: calls OpenAI/Bedrock to generate real data
- Otherwise: returns structured mock JSON
- After responding, calls `recordPurchaseOnChain()` (fire-and-forget)

Mock response examples (agent expects these field shapes):

Sentiment:

```json
{ "ticker": "AAPL", "score": 0.72, "signal": "bullish", "confidence": 0.85, "sources": 15, "summary": "..." }
```

Financial:

```json
{ "topic": "...", "headline": "...", "summary": "...", "impact": "positive", "relevance": 0.9 }
```

Weather:

```json
{ "city": "NYC", "temperature_c": 22, "humidity_pct": 55, "conditions": "sunny", "wind_kph": 12, "forecast": "..." }
```

**Step 4: Write `server/provenance.ts`**

After x402 payment succeeds:

```typescript
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PROVIDER_PRIVATE_KEY, provider);
const marketplace = new ethers.Contract(DATA_MARKETPLACE_ADDRESS, ABI, signer);

async function recordPurchaseOnChain(buyer: string, datasetId: number, pricePaid: number, query: string) {
  const queryHash = ethers.keccak256(ethers.toUtf8Bytes(query));
  const tx = await marketplace.recordPurchase(buyer, datasetId, pricePaid, queryHash);
  console.log(`Purchase recorded on-chain: ${tx.hash}`);
}
```

The `buyer` address comes from the x402 payment header (the wallet that paid). Check x402 middleware docs for how to extract the payer address from the verified payment.

**Step 5: Add npm script**

In `package.json`:

```json
"server": "npx tsx server/index.ts"
```

### Timeline: Week 2 (after Person A deploys contract)

### Dependencies:

- Needs Person A's contract address for provenance recording
- Can develop and test the x402 + data endpoints without the contract (just skip the provenance call)

---

## Person C -- Consumer Agent (DONE)

Code is complete in `agent/`. Files:

| File                  | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `agent/index.ts`      | Main agent: wallet, x402 client, research plan, report generation        |
| `agent/config.ts`     | All config from .env                                                     |
| `agent/queries.ts`    | Research plan builder: 13 queries targeting 5 stocks + 3 cities          |
| `agent/report.ts`     | Terminal report: sentiment rankings, financial highlights, recommendations|
| `agent/visualize.ts`  | HTML report with Chart.js charts (saved to `output/`)                    |
| `agent/provenance.ts` | On-chain purchase verification after run                                 |
| `agent/demo.ts`       | Demo mode with simulated payments (no server needed)                     |
| `server/mock.ts`      | Mock data provider with randomized responses (for local development)     |

Run commands:

```bash
npm run agent        # Real mode (needs server + funded wallet)
npm run agent:demo   # Demo mode (works right now, no dependencies)
npm run server:mock  # Start mock data provider (randomized responses)
```

### What teammates need from Person C

Nothing. The agent is self-contained. It reads config from `.env` and adapts:

- If no `DATA_MARKETPLACE_ADDRESS` -- skips provenance check
- If server returns 402 -- agent stops (balance exhausted)
- If server is down -- agent logs error and stops after 3 consecutive failures

---

## Person D -- Integration + Demo + Report

### What to build

Wire the three components together, prepare the demo, write the report.

### Step-by-step

**Step 1: Integration wiring**

Once A and B are done:

1. Put contract address in `.env`
2. Fund a test wallet with USDC (Coinbase faucet)
3. Set `AGENT_PRIVATE_KEY` in `.env`
4. Start server: `npm run server`
5. Run agent: `npm run agent`
6. Verify it works end-to-end

**Step 2: Demo script**

Write an npm script or shell script that:

1. Starts the server in background
2. Runs the agent
3. After agent stops, queries the contract for purchase history
4. Opens BaseScan link to the contract

**Step 3: Demo flow (what to show in presentation)**

1. Open BaseScan -- show DataMarketplace contract, 3 datasets registered, 0 purchases
2. Run `npm run server` in one terminal
3. Run `npm run agent` in another terminal
4. Watch: wallet created, USDC balance, queries happening, data received, balance decreasing
5. Agent finishes -- see the Investment Research Report with BUY/HOLD/SELL recommendations
6. HTML report opens in browser with charts
7. Refresh BaseScan: `PurchaseRecorded` events visible on-chain
8. Agent's final output shows verified purchase history from the contract

**Step 4: Report**

Key sections:

1. **Introduction** -- The problem: traditional payments don't work for autonomous agents
2. **Related Work** (TA feedback addressed):
  - x402 (Coinbase, May 2025) -- 161M+ txns, HTTP 402 protocol. We build ON TOP of it.
  - Google AP2 (Sep 2025) -- verifiable credentials for enterprise. We show the permissionless alternative.
  - Crossmint -- managed platform. We build raw infrastructure to show how it works.
  - "The Agent Economy" (arXiv:2602.14219, Feb 2026) -- 5-layer architecture. We implement layers 2 + 4.
3. **Architecture** -- the diagram above, explain each component
4. **Smart Contract** -- DataMarketplace design, why provenance matters
5. **Payment Flow** -- x402 protocol explanation with our integration
6. **Autonomous Agent** -- how it works, no human in the loop
7. **Demo Results** -- screenshots of terminal output, BaseScan events, HTML report
8. **Limitations** -- trusted provider, no dispute resolution, testnet only
9. **Future Work** -- payment channels, decentralized service discovery, reputation

**Step 5: Slides (10 slides)**

1. Problem
2. Architecture overview
3. Smart contract design
4. x402 payment protocol
5. Data provider server
6. Autonomous agent
7. Demo (live or recorded)
8. Related work comparison
9. Limitations + future work
10. Conclusion

### Timeline: Week 3

### Dependencies: Needs A and B to be done first.

---

## Dependency Graph

```
Person A (Smart Contract, Week 1) ──> Person B (Server, Week 2) ──> Person D (Integration, Week 3)
                                  ──> Person D                  
Person C (Agent, DONE)            ──> Person D                  
```

Person A has zero dependencies -- start immediately.
Person B can start the server without the contract (just skip provenance), but needs the contract address for full integration.
Person C is done.
Person D waits for A + B, then wires everything together.

---

## Data Flow (Sequence)

```
Agent                   x402 Client         Server              x402 Middleware      Chain / Contract
  |                         |                  |                      |                    |
  |-- POST /api/data/sent --|----------------->|                      |                    |
  |                         |                  |-- check payment ---->|                    |
  |                         |<--- 402 ---------|<---------------------|                    |
  |                         |-- sign USDC ---->|                      |                    |
  |                         |                  |                      |-- settle USDC ---->|
  |                         |-- retry + pay -->|                      |                    |
  |                         |                  |-- verify payment --->|                    |
  |                         |                  |-- generate data      |                    |
  |                         |                  |-- recordPurchase() --|----------------->  |
  |<--- data response ------|------------------|                      |                    |
  |                         |                  |                      |                    |
  |  (repeat for each query)|                  |                      |                    |
  |                         |                  |                      |                    |
  |-- getPurchasesByBuyer() |                  |                      |                    |
  |                         |                  |                      |                    |
```

---

## How This Differs from Existing Work

| System           | What it does                            | How we differ                                                          |
| ---------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| x402 (Coinbase)  | HTTP payment protocol, 161M+ txns       | We USE x402. Our addition: on-chain provenance for what was purchased. |
| Google AP2       | Enterprise credentials + mandate chains | We show the minimal permissionless model.                              |
| Crossmint        | Managed wallet platform                 | We build the raw mechanics from scratch.                               |
| Bittensor / OIXA | Full AI marketplaces                    | We show the minimal payment + provenance core.                         |

---

## Risk Mitigation

- **x402 SDK issues on testnet:** Fall back to manual 402 implementation (~50 lines)
- **Testnet USDC funding:** Use Coinbase faucet; if unavailable, Person A deploys a MockUSDC as backup
- **Demo reliability:** Mock data fallback in server ensures demo works without LLM API keys
- **Contract failure:** Provenance recording is best-effort; data still served if contract write fails
- **Person dependencies:** Person C is done. Person B can develop server + x402 without contract. Only final integration needs all parts.

---

## What NOT to Build

- No frontend UI (terminal + HTML report only)
- No multi-chain support
- No custom token / tokenomics
- No streaming payments or payment channels
- No dispute resolution
- No Docker / CI/CD
