import express, { type Express } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { fileURLToPath } from "url";

import { SERVER_CONFIG } from "./config.js";
import { createDatasetHandler, type ProvenanceRecorder } from "./datasets.js";
import { DATASETS } from "./pricing.js";
import { createProvenanceRecorder } from "./provenance.js";

interface CreateAppOptions {
  enableX402?: boolean;
  provenanceRecorder?: ProvenanceRecorder;
}

export function buildPaymentRoutes(payTo: string) {
  return {
    "POST /api/data/sentiment": {
      accepts: [
        {
          scheme: "exact",
          price: DATASETS.sentiment.price,
          network: SERVER_CONFIG.x402Network,
          payTo,
        },
      ],
      description: DATASETS.sentiment.description,
      mimeType: "application/json",
    },
    "POST /api/data/financial": {
      accepts: [
        {
          scheme: "exact",
          price: DATASETS.financial.price,
          network: SERVER_CONFIG.x402Network,
          payTo,
        },
      ],
      description: DATASETS.financial.description,
      mimeType: "application/json",
    },
    "POST /api/data/weather": {
      accepts: [
        {
          scheme: "exact",
          price: DATASETS.weather.price,
          network: SERVER_CONFIG.x402Network,
          payTo,
        },
      ],
      description: DATASETS.weather.description,
      mimeType: "application/json",
    },
  };
}

function createX402Middleware() {
  if (!SERVER_CONFIG.providerWalletAddress) {
    throw new Error("PROVIDER_WALLET_ADDRESS is required when ENABLE_X402=true");
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: SERVER_CONFIG.x402FacilitatorUrl,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    SERVER_CONFIG.x402Network as `${string}:${string}`,
    new ExactEvmScheme(),
  );

  return paymentMiddleware(
    buildPaymentRoutes(SERVER_CONFIG.providerWalletAddress),
    resourceServer,
  );
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "agentic-payment-data-provider",
      x402: options.enableX402 ?? SERVER_CONFIG.enableX402,
      datasets: Object.values(DATASETS).map((dataset) => ({
        id: dataset.id,
        name: dataset.name,
        price: dataset.price,
      })),
    });
  });

  const enableX402 = options.enableX402 ?? SERVER_CONFIG.enableX402;
  if (enableX402) {
    app.use(createX402Middleware());
  } else {
    console.warn("[server] ENABLE_X402=false; data endpoints are not payment-gated");
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
  app.post(DATASETS.weather.path, createDatasetHandler("weather", recorder));

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
    console.log(`x402 payments: ${SERVER_CONFIG.enableX402 ? "enabled" : "disabled"}`);
  });
}
