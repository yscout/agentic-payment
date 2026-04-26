import { config as loadEnv } from "dotenv";

loadEnv();

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const SERVER_CONFIG = {
  port: numberFromEnv(process.env.PORT, 4021),
  rpcUrl: process.env.RPC_URL || "https://sepolia.base.org",
  x402Network: process.env.X402_NETWORK || "eip155:84532",
  x402FacilitatorUrl: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
  providerWalletAddress: process.env.PROVIDER_WALLET_ADDRESS || "",
  providerPrivateKey: process.env.PROVIDER_PRIVATE_KEY || "",
  marketplaceAddress: process.env.DATA_MARKETPLACE_ADDRESS || "",
  enableX402: boolFromEnv(process.env.ENABLE_X402, true),
} as const;
