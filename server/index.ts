import express, { type Express } from "express";
import { ethers } from "ethers";
import { fileURLToPath } from "url";

import { SERVER_CONFIG } from "./config.js";
import { createDatasetHandler, type ProvenanceRecorder } from "./datasets.js";
import { DATASETS } from "./pricing.js";
import { createProvenanceRecorder } from "./provenance.js";
import { createEthPaymentMiddleware } from "./eth-payment.js";

interface CreateAppOptions {
  enableEthPayment?: boolean;
  provenanceRecorder?: ProvenanceRecorder;
}

function buildPaymentRoutes(payTo: string) {
  return {
    "POST /api/data/sentiment": { amountWei: DATASETS.sentiment.priceWei, payTo },
    "POST /api/data/financial": { amountWei: DATASETS.financial.priceWei, payTo },
    "POST /api/data/weather":   { amountWei: DATASETS.weather.priceWei,   payTo },
  };
}

function createPaymentMiddleware() {
  if (!SERVER_CONFIG.providerWalletAddress) {
    throw new Error("PROVIDER_WALLET_ADDRESS is required");
  }
  const provider = new ethers.JsonRpcProvider(SERVER_CONFIG.rpcUrl);
  return createEthPaymentMiddleware(
    buildPaymentRoutes(ethers.getAddress(SERVER_CONFIG.providerWalletAddress)),
    provider,
  );
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "agentic-payment-data-provider",
      payment: "ETH",
      datasets: Object.values(DATASETS).map((dataset) => ({
        id: dataset.id,
        name: dataset.name,
        price: dataset.price,
      })),
    });
  });

  const enableEthPayment = options.enableEthPayment ?? true;
  if (enableEthPayment) {
    app.use(createPaymentMiddleware());
  } else {
    console.warn("[server] ETH payment disabled; data endpoints are not payment-gated");
  }

  const recorder =
    options.provenanceRecorder ??
    createProvenanceRecorder({
      rpcUrl: SERVER_CONFIG.rpcUrl,
      marketplaceAddress: SERVER_CONFIG.marketplaceAddress,
      providerPrivateKey: SERVER_CONFIG.providerPrivateKey,
    });

  app.post(DATASETS.sentiment.path, createDatasetHandler("sentiment", recorder));
  app.post(DATASETS.financial.path, createDatasetHandler("financial", recorder));
  app.post(DATASETS.weather.path,   createDatasetHandler("weather", recorder));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const app = createApp();
  app.listen(SERVER_CONFIG.port, () => {
    console.log(`Data provider running on http://localhost:${SERVER_CONFIG.port}`);
    console.log(`ETH payments: enabled`);
  });
}
