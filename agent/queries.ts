import { type DatasetType } from "./config.js";

export interface QueryTask {
  dataset: DatasetType;
  query: string;
  purpose: string;
}

/**
 * The agent's research mission: analyze these 5 stocks.
 * For each stock it needs sentiment data and financial data.
 * It also checks weather in key financial cities (affects trading floors).
 */
const TARGET_STOCKS = ["AAPL", "TSLA", "NVDA", "GOOGL", "AMZN"];

const FINANCIAL_TOPICS: Record<string, string> = {
  AAPL: "Apple Q1 earnings",
  TSLA: "Tesla delivery numbers",
  NVDA: "NVIDIA AI chip demand",
  GOOGL: "Google cloud revenue growth",
  AMZN: "Amazon AWS market share",
};

const MARKET_CITIES = ["New York", "London", "Tokyo"];

export function buildResearchPlan(): QueryTask[] {
  const tasks: QueryTask[] = [];

  for (const stock of TARGET_STOCKS) {
    tasks.push({
      dataset: "sentiment",
      query: stock,
      purpose: `Get market sentiment for ${stock}`,
    });
  }

  for (const stock of TARGET_STOCKS) {
    tasks.push({
      dataset: "financial",
      query: FINANCIAL_TOPICS[stock],
      purpose: `Get financial analysis for ${stock}`,
    });
  }

  for (const city of MARKET_CITIES) {
    tasks.push({
      dataset: "weather",
      query: city,
      purpose: `Check conditions at ${city} trading hub`,
    });
  }

  return tasks;
}

export function getTargetStocks(): string[] {
  return [...TARGET_STOCKS];
}
