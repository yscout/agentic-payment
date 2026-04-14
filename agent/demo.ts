/**
 * Demo Mode -- Simulates the full agent flow locally.
 *
 * Same mission as the real agent (investment research report)
 * but with simulated payments and mock data. No server needed.
 *
 * Run: npm run agent:demo
 */

import { ethers } from "ethers";
import { buildResearchPlan, type QueryTask } from "./queries.js";
import { DATASET_ENDPOINTS } from "./config.js";
import {
  createEmptyCollection,
  printReport,
  type SentimentData,
  type FinancialData,
  type WeatherData,
  type CollectedData,
} from "./report.js";
import { saveAndOpenReport } from "./visualize.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function mockSentiment(query: string): SentimentData {
  return {
    ticker: query,
    score: +(Math.random() * 2 - 1).toFixed(3),
    signal: Math.random() > 0.5 ? "bullish" : "bearish",
    confidence: +(0.6 + Math.random() * 0.35).toFixed(2),
    sources: Math.floor(5 + Math.random() * 20),
    summary: `Market sentiment for ${query} based on ${Math.floor(5 + Math.random() * 20)} recent sources.`,
  };
}

function mockFinancial(query: string): FinancialData {
  return {
    topic: query,
    headline: `${query}: Key developments and market implications`,
    summary: `Analysis of ${query} shows mixed signals with moderate volatility expected in the near term.`,
    impact: ["positive", "negative", "neutral"][Math.floor(Math.random() * 3)],
    relevance: +(0.7 + Math.random() * 0.3).toFixed(2),
  };
}

function mockWeather(query: string): WeatherData {
  return {
    city: query,
    temperature_c: Math.floor(5 + Math.random() * 30),
    humidity_pct: Math.floor(30 + Math.random() * 60),
    conditions: ["sunny", "cloudy", "rainy", "partly cloudy", "overcast"][
      Math.floor(Math.random() * 5)
    ],
    wind_kph: Math.floor(5 + Math.random() * 40),
    forecast: `${query}: moderate conditions expected over the next 24 hours.`,
  };
}

function generateMock(task: QueryTask): SentimentData | FinancialData | WeatherData {
  switch (task.dataset) {
    case "sentiment": return mockSentiment(task.query);
    case "financial": return mockFinancial(task.query);
    case "weather":   return mockWeather(task.query);
  }
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
  console.log("║  ** DEMO MODE -- simulated payments **                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Step 1: Wallet
  log("STEP 1: Setting up wallet...");
  const wallet = ethers.Wallet.createRandom();
  log(`Created wallet: ${wallet.address}`);
  log(`  USDC balance: 0.020000 USDC (simulated)`);
  let balanceUsd = 0.02;

  // Step 2: Plan
  log("\nSTEP 2: Planning research...");
  const tasks = buildResearchPlan();

  let estimatedCost = 0;
  for (const task of tasks) {
    estimatedCost += parseFloat(DATASET_ENDPOINTS[task.dataset].price.replace("$", ""));
  }

  log(`  Target stocks:    AAPL, TSLA, NVDA, GOOGL, AMZN`);
  log(`  Data to purchase: ${tasks.length} queries`);
  log(`    - ${tasks.filter(t => t.dataset === "sentiment").length} sentiment queries`);
  log(`    - ${tasks.filter(t => t.dataset === "financial").length} financial queries`);
  log(`    - ${tasks.filter(t => t.dataset === "weather").length} weather queries`);
  log(`  Estimated cost:   $${estimatedCost.toFixed(4)} USDC`);
  log(`  Available budget: ${balanceUsd.toFixed(6)} USDC`);

  // Step 3: Buy data
  log("\nSTEP 3: Purchasing data from provider...");
  log("  (x402 handles payment automatically on each request)\n");

  const collected = createEmptyCollection();
  let totalSpent = 0;
  let completedCount = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const price = parseFloat(DATASET_ENDPOINTS[task.dataset].price.replace("$", ""));
    const progress = `[${i + 1}/${tasks.length}]`;

    if (balanceUsd < price) {
      log(`${progress} ${task.purpose} (${DATASET_ENDPOINTS[task.dataset].price})`);
      log(`  FAILED: Out of funds -- cannot complete research`);
      break;
    }

    log(`${progress} ${task.purpose} (${DATASET_ENDPOINTS[task.dataset].price})`);

    const mockData = generateMock(task);
    storeResult(collected, task, mockData);
    balanceUsd -= price;
    totalSpent += price;
    completedCount++;

    const summary = JSON.stringify(mockData).slice(0, 80);
    log(`  OK: ${summary}...`);

    await sleep(400);
  }

  // Step 4: Report
  log("\nSTEP 4: Assembling research report...");
  printReport(collected, totalSpent);
  saveAndOpenReport(collected, totalSpent, wallet.address, completedCount, balanceUsd.toFixed(6));

  // Step 5: Summary
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  SESSION SUMMARY                                           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  log(`Queries completed: ${completedCount}/${tasks.length}`);
  log(`Total spent:       $${totalSpent.toFixed(4)} USDC`);
  log(`Remaining balance: ${balanceUsd.toFixed(6)} USDC`);
  log(`Wallet:            ${wallet.address}`);

  console.log("\n[Provenance] No DataMarketplace address -- skipping on-chain verification");
  log("\nAgent shut down.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
