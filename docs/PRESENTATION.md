# Agentic Payment System — 5-Minute Presentation Script

**Format:** 4 people, ~1 minute 15 seconds each, total 5:00
**Roles** map to the original team plan: Person A (Smart Contract), Person B (Server),
Person C (Consumer Agent), Person D (Integration + Demo).

---

## Timing breakdown

| Segment | Speaker        | Topic                              | Time         |
| ------- | -------------- | ---------------------------------- | ------------ |
| Intro   | Xuechen (D)    | Problem framing + what we built    | 0:00 – 0:30  |
| Part 1  | Angie (A)      | Smart contract: on-chain provenance| 0:30 – 1:45  |
| Part 2  | Yutao (B)      | Server: HTTP payment middleware    | 1:45 – 3:00  |
| Part 3  | Tianliang (C)  | Autonomous consumer agent          | 3:00 – 4:00  |
| Demo    | Xuechen (D)    | Live demo + BaseScan audit         | 4:00 – 4:45  |
| Close   | Xuechen (D)    | Limitations + so what              | 4:45 – 5:00  |

---

## 0:00 – 0:30 · Intro — Xuechen (Person D)

> Imagine an AI agent that needs to buy data to make decisions in real time —
> stock sentiment, weather, news. How does it pay the provider? Not with
> a credit card; that needs a human in the loop. Not with a stored API key;
> that requires pre-funded subscriptions and a trust relationship.
>
> We built an **agentic payment system** where an autonomous agent
> creates its own wallet, pays per query in ETH on Base Sepolia, and every
> single purchase is recorded immutably on-chain. No human approves any
> payment, and the entire audit trail is verifiable by anyone — including you.

*(Hand off to Angie.)*

---

## 0:30 – 1:45 · Smart Contract — Angie (Person A)

> The on-chain piece is a single Solidity contract called `DataMarketplace`,
> deployed on Base Sepolia. It does two things.
>
> **First**, it's a registry of datasets — `sentiment`, `financial`, `weather`
> — each with a name, description, and price in wei. The owner registers
> them once at deploy time.
>
> **Second**, and this is what makes our project different from existing payment
> protocols like Coinbase's x402, it records **who bought what, when, and
> for how much**. Every time the agent buys data, the server calls
> `recordPurchase(buyer, datasetId, pricePaid, queryHash)`. That call writes
> a struct to an append-only array and emits a `PurchaseRecorded` event.
>
> A key design decision: we separate the contract **owner** (who registers
> datasets) from the **recorder role** (who logs purchases). The owner uses
> `setRecorder()` to authorize the server's wallet. This means the server
> doesn't need the owner's private key to do its job — important for
> operational security if you ever scale beyond a demo.
>
> One subtle thing we got right: `pricePaid` is stored in **wei**, the same
> unit the agent actually paid. We initially had it in micro-USD and the
> on-chain numbers didn't match real transfers — the "audit trail" was
> lying. We fixed it; now BaseScan, the agent's wallet, and the contract
> all agree on every number to the wei.

*(Hand off to Yutao.)*

---

## 1:45 – 3:00 · Data Provider Server — Yutao (Person B)

> The data provider is an Express server with three pay-walled endpoints:
> `/api/data/sentiment`, `/api/data/financial`, `/api/data/weather`.
>
> The original plan called for Coinbase's x402 protocol — the new HTTP 402
> standard for machine payments. We evaluated x402 and ultimately built a
> **minimal HTTP 402 implementation ourselves**. The reason: x402 abstracts
> away the cryptographic verification behind a facilitator service. For a
> research project where the whole point is to *understand* agent payments,
> we wanted to see the verification code with our own eyes.
>
> Here's how a single purchase flows:
>
> 1. Agent sends ETH to the provider's wallet on-chain.
> 2. Agent POSTs the request with `X-Payment-Tx: <txHash>` header.
> 3. Our middleware looks up that tx hash via JSON-RPC. It checks: does
>    the recipient match? Is the amount enough? Has this tx hash been used
>    before, to prevent replays?
> 4. If all good, we attach the buyer's address — extracted from the
>    transaction's `from` field — to the request, then serve the data.
> 5. After responding, we fire-and-forget a call to
>    `DataMarketplace.recordPurchase()` to write the audit record.
>
> Provenance recording is best-effort and asynchronous: if the contract
> call fails, the buyer still gets their data. The payment already happened
> on-chain — the contract is just the ledger, not the payment rail itself.

*(Hand off to Tianliang.)*

---

## 3:00 – 4:00 · Consumer Agent — Tianliang (Person C)

> The agent is the autonomous piece. On startup, it loads an `ethers.js`
> wallet — either from a private key in `.env`, or it generates a fresh one.
> No MetaMask, no human signing prompts, no OAuth.
>
> The agent has a mission: produce a buy / hold / sell summary for five
> stocks — Apple, Tesla, NVIDIA, Google, and Amazon. To produce that
> summary, it plans 13 data purchases: 5 sentiment queries, 5 financial
> queries, and 3 weather checks for major trading hubs.
>
> The query loop is where the autonomy lives. For each query:
> ETH transfer goes out, the tx hash gets attached to the HTTP request,
> the agent waits for the response, stores the data, and moves on. If it
> hits a 402 — meaning the server rejected the payment — it stops; that
> means the wallet is broke. If three consecutive requests fail, it stops.
>
> At the end of the run, the agent does something important: it queries the
> contract directly via `getPurchasesByBuyer(self)` and reads back its own
> purchase history from the blockchain. It then sums up `pricePaid` across
> all entries and compares that total against what its own internal counter
> says it spent. If those two numbers don't match — we have a bug somewhere.

*(Hand off back to Xuechen for the demo.)*

---

## 4:00 – 4:45 · Live Demo — Xuechen (Person D)

> *(Split-screen: terminal on the left, BaseScan on the right.)*
>
> One command — `npm run demo:local` — spins up everything: a blockchain
> node, deploys the contract, registers three datasets, starts the server,
> and launches the agent.
>
> *(Pause for terminal to scroll through purchases.)*
>
> Watch the right side. BaseScan — Coinbase's official block explorer for
> Base — shows our contract address. As the agent runs, every purchase
> emits a `PurchaseRecorded` event that shows up here. At the end:
>
> - The agent says: **Total spent — 0.0000165 ETH**.
> - The contract's audit trail, summed across all 13 purchases: **0.0000165
>   ETH**.
> - The agent's wallet on-chain balance dropped by exactly that, plus gas.
>
> Three independent sources, three matching numbers. That's what "on-chain
> provenance" means: no one can fake it after the fact, including us.

---

## 4:45 – 5:00 · Limitations + Closing — Xuechen (Person D)

> A few honest limitations. The provider is trusted — there's no
> cryptographic proof the data they sent matches what was promised. There's
> no dispute resolution if the data is wrong. And we're on testnet, so
> nothing has real economic stakes.
>
> But the core mechanic — *autonomous payment plus on-chain provenance*
> — is the minimal permissionless template for AI agents to transact
> with each other. Once you can prove every interaction happened, you can
> layer reputation, escrow, and streaming payments on top.
>
> Thank you.

---

## Stage directions / production notes

- **Open terminal and BaseScan side-by-side before the demo segment.**
  Pre-load https://sepolia.basescan.org/address/<contract-address>#events
  in a browser tab so it's instant.
- **Pre-run the demo once before recording** so the contract is already
  deployed and the agent's wallet is funded. The video should show *a*
  fresh run, not the very first deploy.
- **Have a backup local demo ready** in case the testnet RPC is slow during
  recording. `npm run demo:local` works without any network.
- **Highlight the wei-matching moment** — that's the strongest evidence and
  the most distinctive thing about this project. Linger on it for 3
  seconds.
- For the smart-contract segment, having the contract source visible
  (`contracts/DataMarketplace.sol`) helps the audience trust the claim
  about provenance.

---

## What to cut if you're over time

In order of "cut first":
1. Drop the `setRecorder` / authorization point (Angie, save ~10s)
2. Compress the x402 mention to one sentence (Yutao, save ~15s)
3. Drop the "5 stocks" list — just say "a few stocks" (Tianliang, save ~5s)
4. Drop the limitations section entirely (Xuechen, save ~15s)

## What to add if you have spare time

1. Show the contract source on screen during Angie's segment
2. Show `npm test` passing (33 tests) right before the demo
3. Show the HTML report the agent generates at the end
4. Reference one specific related-work paper from the original plan

---

## Related work mentions (for Q&A, not in the script)

These were in the original plan; have them ready in case of questions:

- **x402** (Coinbase, May 2025) — 161M+ HTTP-402 transactions. We build
  the minimal core ourselves to show how it works under the hood.
- **AP2** (Google, Sept 2025) — verifiable credentials and mandate chains
  for enterprise agents. We show the permissionless alternative.
- **Crossmint** — managed wallet platform. We build raw mechanics
  rather than depend on a vendor.
- *The Agent Economy* (arXiv:2602.14219, Feb 2026) — 5-layer architecture
  for autonomous agents; this project implements layers 2 (payment) and 4
  (provenance).
