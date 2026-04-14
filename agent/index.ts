/**
 * Autonomous Consumer Agent
 *
 * MISSION: Produce an investment research report for 5 stocks.
 *
 * The agent needs sentiment data, financial analysis, and market
 * conditions -- but it doesn't have this data. It buys it from
 * a Data Provider agent, paying per-query with USDC via the x402
 * protocol. No human approves any payment.
 *
 * Flow:
 *   1. Create/load wallet
 *   2. Plan research (13 data purchases needed)
 *   3. Buy data query-by-query (x402 auto-pay)
 *   4. Assemble findings into an investment report
 *   5. Verify all purchases on-chain
 */

import { ethers } from "ethers";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

import { AGENT_CONFIG, DATASET_ENDPOINTS, type DatasetType } from "./config.js";
import { buildResearchPlan, type QueryTask } from "./queries.js";
import {
  createEmptyCollection,
  printReport,
  type CollectedData,
  type SentimentData,
  type FinancialData,
  type WeatherData,
} from "./report.js";
import { verifyPurchaseHistory } from "./provenance.js";
import { saveAndOpenReport } from "./visualize.js";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

async function setupWallet(): Promise<{
  wallet: ethers.Wallet | ethers.HDNodeWallet;
  provider: ethers.JsonRpcProvider;
}> {
  const provider = new ethers.JsonRpcProvider(AGENT_CONFIG.rpcUrl);

  let wallet: ethers.Wallet | ethers.HDNodeWallet;
  if (AGENT_CONFIG.privateKey) {
    wallet = new ethers.Wallet(AGENT_CONFIG.privateKey, provider);
    log(`Loaded existing wallet: ${wallet.address}`);
  } else {
    wallet = ethers.Wallet.createRandom().connect(provider);
    log(`Created new wallet: ${wallet.address}`);
    log(`Private key (save this): ${wallet.privateKey}`);
  }

  return { wallet, provider };
}

async function getUsdcBalance(
  provider: ethers.JsonRpcProvider,
  address: string,
): Promise<bigint> {
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  return usdc.balanceOf(address);
}

function formatUsdc(amount: bigint): string {
  return (Number(amount) / 1e6).toFixed(6);
}

function createPaymentFetch(privateKey: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: AGENT_CONFIG.x402Network as `${string}:${string}`,
        client: new ExactEvmScheme(account),
      },
    ],
  });
}

async function buyData(
  paymentFetch: typeof fetch,
  dataset: DatasetType,
  query: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const endpoint = DATASET_ENDPOINTS[dataset];
  const url = `${AGENT_CONFIG.serverUrl}${endpoint.path}`;

  const response = await paymentFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    if (response.status === 402) {
      return { ok: false, status: 402, data: "Insufficient USDC balance" };
    }
    return { ok: false, status: response.status, data: await response.text() };
  }

  return { ok: true, status: 200, data: await response.json() };
}

function storeResult(collected: CollectedData, task: QueryTask, data: unknown): void {
  switch (task.dataset) {
    case "sentiment":
      collected.sentiment.set(task.query, data as SentimentData);
      break;
    case "financial":
      collected.financial.set(task.query, data as FinancialData);
      break;
    case "weather":
      collected.weather.set(task.query, data as WeatherData);
      break;
  }
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  AUTONOMOUS DATA CONSUMER AGENT                            ║");
  console.log("║  Mission: Produce investment research report                ║");
  console.log("║  Payment: x402 protocol on Base Sepolia                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // --- Step 1: Wallet ---
  log("STEP 1: Setting up wallet...");
  const { wallet, provider } = await setupWallet();

  const usdc = await getUsdcBalance(provider, wallet.address);
  const eth = await provider.getBalance(wallet.address);
  log(`  ETH:  ${ethers.formatEther(eth)}`);
  log(`  USDC: ${formatUsdc(usdc)}`);

  if (usdc === 0n) {
    log("");
    log("No USDC balance. Fund this wallet to proceed:");
    log(`  Address: ${wallet.address}`);
    log(`  ETH faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet`);
    log(`  USDC faucet: https://faucet.circle.com/ (select Base Sepolia)`);
    log(`  Then set AGENT_PRIVATE_KEY=${wallet.privateKey} in .env`);
    process.exit(1);
  }

  // --- Step 2: Plan research ---
  log("\nSTEP 2: Planning research...");
  const tasks = buildResearchPlan();

  let estimatedCost = 0;
  for (const task of tasks) {
    const price = parseFloat(DATASET_ENDPOINTS[task.dataset].price.replace("$", ""));
    estimatedCost += price;
  }

  log(`  Target stocks:    AAPL, TSLA, NVDA, GOOGL, AMZN`);
  log(`  Data to purchase: ${tasks.length} queries`);
  log(`    - ${tasks.filter(t => t.dataset === "sentiment").length} sentiment queries`);
  log(`    - ${tasks.filter(t => t.dataset === "financial").length} financial queries`);
  log(`    - ${tasks.filter(t => t.dataset === "weather").length} weather queries`);
  log(`  Estimated cost:   $${estimatedCost.toFixed(4)} USDC`);
  log(`  Available budget: ${formatUsdc(usdc)} USDC`);

  // --- Step 3: Buy data ---
  log("\nSTEP 3: Purchasing data from provider...");
  log("  (x402 handles payment automatically on each request)\n");

  const paymentFetch = createPaymentFetch(wallet.privateKey);
  const collected = createEmptyCollection();
  let completedCount = 0;
  let failedCount = 0;
  let totalSpent = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const price = parseFloat(DATASET_ENDPOINTS[task.dataset].price.replace("$", ""));
    const progress = `[${i + 1}/${tasks.length}]`;

    log(`${progress} ${task.purpose} (${DATASET_ENDPOINTS[task.dataset].price})`);

    try {
      const result = await buyData(paymentFetch, task.dataset, task.query);

      if (!result.ok) {
        if (result.status === 402) {
          log(`  FAILED: Out of funds -- cannot complete research`);
          failedCount++;
          break;
        }
        log(`  FAILED: Server error (${result.status})`);
        failedCount++;
        continue;
      }

      storeResult(collected, task, result.data);
      totalSpent += price;
      completedCount++;

      const summary = JSON.stringify(result.data).slice(0, 80);
      log(`  OK: ${summary}...`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`  FAILED: ${errMsg}`);
      failedCount++;
    }

    await sleep(AGENT_CONFIG.queryIntervalMs);
  }

  // --- Step 4: Generate report ---
  log("\nSTEP 4: Assembling research report...");

  const finalUsdc = await getUsdcBalance(provider, wallet.address);

  if (completedCount === 0) {
    log("  No data collected -- cannot generate report");
  } else {
    printReport(collected, totalSpent);
    saveAndOpenReport(
      collected,
      totalSpent,
      wallet.address,
      completedCount,
      formatUsdc(finalUsdc),
    );
  }

  // --- Step 5: Summary + provenance ---
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  SESSION SUMMARY                                           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  log(`Queries completed: ${completedCount}/${tasks.length}`);
  log(`Queries failed:    ${failedCount}`);
  log(`Total spent:       $${totalSpent.toFixed(4)} USDC`);
  log(`Remaining balance: ${formatUsdc(finalUsdc)} USDC`);
  log(`Wallet:            ${wallet.address}`);

  await verifyPurchaseHistory(wallet.address);

  log("\nAgent shut down.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
