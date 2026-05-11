import { config } from "dotenv";
config();

export const AGENT_CONFIG = {
  privateKey: process.env.AGENT_PRIVATE_KEY || "",
  rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
  serverUrl: process.env.SERVER_URL || "http://localhost:4021",
  providerWalletAddress: process.env.PROVIDER_WALLET_ADDRESS || "",
  marketplaceAddress: process.env.DATA_MARKETPLACE_ADDRESS || "",
  queryIntervalMs: (Number(process.env.QUERY_INTERVAL_SECONDS) || 3) * 1000,
  maxQueries: Number(process.env.MAX_QUERIES) || 0,
} as const;

export const DATASET_ENDPOINTS = {
  sentiment: {
    path: "/api/data/sentiment",
    price: "0.000001 ETH",
    priceEth: "0.000001",
    description: "Market sentiment analysis",
  },
  financial: {
    path: "/api/data/financial",
    price: "0.000002 ETH",
    priceEth: "0.000002",
    description: "Financial news summary",
  },
  weather: {
    path: "/api/data/weather",
    price: "0.0000005 ETH",
    priceEth: "0.0000005",
    description: "Weather forecast data",
  },
} as const;

export type DatasetType = keyof typeof DATASET_ENDPOINTS;
