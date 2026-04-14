import { config } from "dotenv";
config();

export const AGENT_CONFIG = {
  privateKey: process.env.AGENT_PRIVATE_KEY || "",
  rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
  x402Network: process.env.X402_NETWORK || "eip155:84532",
  serverUrl: process.env.SERVER_URL || "http://localhost:4021",
  marketplaceAddress: process.env.DATA_MARKETPLACE_ADDRESS || "",
  queryIntervalMs: (Number(process.env.QUERY_INTERVAL_SECONDS) || 3) * 1000,
  maxQueries: Number(process.env.MAX_QUERIES) || 0,
  depositAmount: process.env.DEPOSIT_AMOUNT || "0.10",
} as const;

export const USDC_DECIMALS = 6;

export const DATASET_ENDPOINTS = {
  sentiment: {
    path: "/api/data/sentiment",
    price: "$0.001",
    description: "Market sentiment analysis",
  },
  financial: {
    path: "/api/data/financial",
    price: "$0.002",
    description: "Financial news summary",
  },
  weather: {
    path: "/api/data/weather",
    price: "$0.0005",
    description: "Weather forecast data",
  },
} as const;

export type DatasetType = keyof typeof DATASET_ENDPOINTS;
