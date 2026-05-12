/**
 * Autonomous Consumer Agent
 *
 * MISSION: Produce an investment research report for 5 stocks.
 *
 * The agent needs sentiment data, financial analysis, and market
 * conditions -- but it doesn't have this data. It buys it from
 * a Data Provider agent, paying per-query with ETH on Base Sepolia.
 * No human approves any payment.
 *
 * Flow:
 *   1. Create/load wallet
 *   2. Plan research (13 data purchases needed)
 *   3. Buy data query-by-query (send ETH → include tx hash)
 *   4. Assemble findings into an investment report
 *   5. Verify all purchases on-chain
 */

import { ethers } from "ethers";

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

async function sendEthPayment(
  wallet: ethers.Wallet | ethers.HDNodeWallet,
  to: string,
  amountWei: bigint,
): Promise<string> {
  const tx = await wallet.sendTransaction({ to, value: amountWei });
  await tx.wait(1);
  return tx.hash;
}

async function buyData(
  wallet: ethers.Wallet | ethers.HDNodeWallet,
  dataset: DatasetType,
  query: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const endpoint = DATASET_ENDPOINTS[dataset];
  const url = `${AGENT_CONFIG.serverUrl}${endpoint.path}`;
  const amountWei = ethers.parseEther(endpoint.priceEth);

  const txHash = await sendEthPayment(wallet, AGENT_CONFIG.providerWalletAddress, amountWei);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Tx": txHash,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    if (response.status === 402) {
      return { ok: false, status: 402, data: "Payment rejected by server" };
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
  console.log("║  Payment: ETH on Base Sepolia                              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // --- Step 1: Wallet ---
  log("STEP 1: Setting up wallet...");

  // Verify server is reachable before spending any ETH
  try {
    const health = await fetch(`${AGENT_CONFIG.serverUrl}/health`);
    if (!health.ok) throw new Error(`status ${health.status}`);
  } catch (err) {
    log(`Server not reachable at ${AGENT_CONFIG.serverUrl} -- start the server first`);
    log("  Run: npm run server");
    process.exit(1);
  }

  const { wallet, provider } = await setupWallet();

  const eth = await provider.getBalance(wallet.address);
  log(`  ETH: ${ethers.formatEther(eth)}`);

  if (eth === 0n) {
    log("");
    log("No ETH balance. Fund this wallet to proceed:");
    log(`  Address: ${wallet.address}`);
    log(`  ETH faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet`);
    log(`  Then set AGENT_PRIVATE_KEY=${wallet.privateKey} in .env`);
    process.exit(1);
  }

  if (!AGENT_CONFIG.providerWalletAddress) {
    log("PROVIDER_WALLET_ADDRESS not set in .env");
    process.exit(1);
  }

  // --- Step 2: Plan research ---
  log("\nSTEP 2: Planning research...");
  const tasks = buildResearchPlan();

  let estimatedCost = 0;
  for (const task of tasks) {
    estimatedCost += parseFloat(DATASET_ENDPOINTS[task.dataset].priceEth);
  }

  log(`  Target stocks:    AAPL, TSLA, NVDA, GOOGL, AMZN`);
  log(`  Data to purchase: ${tasks.length} queries`);
  log(`    - ${tasks.filter(t => t.dataset === "sentiment").length} sentiment queries`);
  log(`    - ${tasks.filter(t => t.dataset === "financial").length} financial queries`);
  log(`    - ${tasks.filter(t => t.dataset === "weather").length} weather queries`);
  log(`  Estimated cost:   ${estimatedCost.toFixed(8)} ETH`);
  log(`  Available budget: ${ethers.formatEther(eth)} ETH`);

  // --- Step 3: Buy data ---
  log("\nSTEP 3: Purchasing data from provider...");
  log("  (sending ETH payment with each request)\n");

  const collected = createEmptyCollection();
  let completedCount = 0;
  let failedCount = 0;
  let totalSpent = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const priceEth = parseFloat(DATASET_ENDPOINTS[task.dataset].priceEth);
    const progress = `[${i + 1}/${tasks.length}]`;

    log(`${progress} ${task.purpose} (${DATASET_ENDPOINTS[task.dataset].price})`);

    try {
      const result = await buyData(wallet, task.dataset, task.query);

      if (!result.ok) {
        if (result.status === 402) {
          log(`  FAILED: Payment rejected -- cannot complete research`);
          failedCount++;
          break;
        }
        log(`  FAILED: Server error (${result.status})`);
        failedCount++;
        continue;
      }

      storeResult(collected, task, result.data);
      totalSpent += priceEth;
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

  const finalEth = await provider.getBalance(wallet.address);

  if (completedCount === 0) {
    log("  No data collected -- cannot generate report");
  } else {
    printReport(collected, totalSpent);
    saveAndOpenReport(
      collected,
      totalSpent,
      wallet.address,
      completedCount,
      ethers.formatEther(finalEth),
    );
  }

  // --- Step 5: Summary + provenance ---
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  SESSION SUMMARY                                           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  log(`Queries completed: ${completedCount}/${tasks.length}`);
  log(`Queries failed:    ${failedCount}`);
  log(`Total spent:       ${totalSpent.toFixed(8)} ETH`);
  log(`Remaining balance: ${ethers.formatEther(finalEth)} ETH`);
  log(`Wallet:            ${wallet.address}`);

  await verifyPurchaseHistory(wallet.address);

  const isLocalChain = /127\.0\.0\.1|localhost/.test(AGENT_CONFIG.rpcUrl);
  if (AGENT_CONFIG.marketplaceAddress && !isLocalChain) {
    const basescanUrl = `https://sepolia.basescan.org/address/${AGENT_CONFIG.marketplaceAddress}#events`;
    log(`\nOn-chain purchases: ${basescanUrl}`);
    const { execSync } = await import("child_process");
    try {
      execSync(`open "${basescanUrl}"`, { stdio: "ignore" });
    } catch {
      // non-Mac fallback already printed the URL above
    }
  } else if (AGENT_CONFIG.marketplaceAddress && isLocalChain) {
    log(`\nRunning on local Hardhat chain (RPC: ${AGENT_CONFIG.rpcUrl}).`);
    log(`Contract address ${AGENT_CONFIG.marketplaceAddress} only exists locally.`);
  }

  log("\nAgent shut down.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
