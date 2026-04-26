import { DATASETS, type DatasetType } from "./pricing.js";
import { extractBuyerAddressFromRequest, type PaymentRequestLike } from "./provenance-utils.js";

export interface SentimentResponse {
  ticker: string;
  score: number;
  signal: "bullish" | "bearish" | "neutral";
  confidence: number;
  sources: number;
  summary: string;
}

export interface FinancialResponse {
  topic: string;
  headline: string;
  summary: string;
  impact: "positive" | "negative" | "neutral";
  relevance: number;
}

export interface WeatherResponse {
  city: string;
  temperature_c: number;
  humidity_pct: number;
  conditions: string;
  wind_kph: number;
  forecast: string;
}

export type DatasetResponse = SentimentResponse | FinancialResponse | WeatherResponse;

export interface RecordPurchaseInput {
  buyer: string;
  dataset: DatasetType;
  datasetId: number;
  pricePaid: number;
  query: string;
}

export interface ProvenanceRecorder {
  recordPurchase(input: RecordPurchaseInput): Promise<void>;
}

export interface DatasetRequestLike extends PaymentRequestLike {
  body?: unknown;
}

export interface DatasetResponseLike {
  status(code: number): DatasetResponseLike;
  json(body: unknown): void;
}

export class QueryValidationError extends Error {
  constructor(message = "Invalid query") {
    super(message);
    this.name = "QueryValidationError";
  }
}

const SENTIMENT_BASES: Record<string, { center: number; spread: number; summaries: string[] }> = {
  AAPL: {
    center: 0.4,
    spread: 0.35,
    summaries: [
      "Apple momentum is supported by services revenue and device upgrade demand.",
      "Apple sentiment is mixed as international sales risk offsets services growth.",
      "Investors remain cautiously optimistic about Apple's AI product roadmap.",
    ],
  },
  TSLA: {
    center: -0.15,
    spread: 0.5,
    summaries: [
      "Tesla sentiment remains volatile amid EV competition and margin pressure.",
      "Robotaxi optimism is partially offset by delivery and pricing concerns.",
      "Tesla investors are split between long-term autonomy upside and near-term demand risk.",
    ],
  },
  NVDA: {
    center: 0.8,
    spread: 0.2,
    summaries: [
      "NVIDIA sentiment is strongly positive as AI accelerator demand remains elevated.",
      "Data center growth continues to support bullish market positioning for NVIDIA.",
      "NVIDIA supply constraints reinforce pricing power despite export-control risk.",
    ],
  },
  GOOGL: {
    center: 0.2,
    spread: 0.4,
    summaries: [
      "Google sentiment is balanced between Cloud growth and AI search disruption risk.",
      "Regulatory pressure weighs on Google despite durable advertising revenue.",
      "Google Cloud profitability and Gemini adoption are improving sentiment.",
    ],
  },
  AMZN: {
    center: 0.55,
    spread: 0.3,
    summaries: [
      "Amazon sentiment is positive as AWS growth and advertising strength continue.",
      "Amazon margin improvement is supporting a constructive investor outlook.",
      "AWS AI platform adoption remains a positive catalyst for Amazon.",
    ],
  },
};

const FINANCIAL_VARIANTS: Record<string, Array<Omit<FinancialResponse, "topic">>> = {
  "Apple Q1 earnings": [
    {
      headline: "Apple Q1 revenue beats estimates as services hit record levels",
      summary: "Services growth and premium iPhone demand offset pockets of regional weakness.",
      impact: "positive",
      relevance: 0.95,
    },
    {
      headline: "Apple guidance stays cautious despite solid earnings beat",
      summary: "Management highlighted stable demand, but investors remain focused on China and AI execution.",
      impact: "neutral",
      relevance: 0.9,
    },
  ],
  "Tesla delivery numbers": [
    {
      headline: "Tesla deliveries trail expectations as EV competition intensifies",
      summary: "Lower deliveries and price cuts point to continued pressure on automotive gross margin.",
      impact: "negative",
      relevance: 0.92,
    },
    {
      headline: "Tesla energy growth offsets part of delivery disappointment",
      summary: "Storage deployments remain a bright spot, but vehicle demand is the primary investor concern.",
      impact: "negative",
      relevance: 0.89,
    },
  ],
  "NVIDIA AI chip demand": [
    {
      headline: "NVIDIA AI accelerator demand remains supply constrained",
      summary: "Cloud and enterprise buyers continue to compete for capacity, supporting revenue visibility.",
      impact: "positive",
      relevance: 0.97,
    },
    {
      headline: "NVIDIA backlog extends as hyperscalers increase AI infrastructure spend",
      summary: "Large customers continue ordering next-generation GPUs for model training and inference.",
      impact: "positive",
      relevance: 0.96,
    },
  ],
  "Google cloud revenue growth": [
    {
      headline: "Google Cloud growth improves with stronger AI workload demand",
      summary: "Cloud profitability and enterprise AI adoption remain the most important positive drivers.",
      impact: "positive",
      relevance: 0.88,
    },
    {
      headline: "Google Cloud margin expansion helps offset search disruption concerns",
      summary: "Investors are watching whether AI products can defend search economics over time.",
      impact: "neutral",
      relevance: 0.86,
    },
  ],
  "Amazon AWS market share": [
    {
      headline: "AWS maintains cloud leadership as growth reaccelerates",
      summary: "Enterprise migration and AI services support durable demand for AWS infrastructure.",
      impact: "positive",
      relevance: 0.91,
    },
    {
      headline: "AWS AI services gain traction with enterprise customers",
      summary: "Managed model services and custom chips are improving Amazon's cloud positioning.",
      impact: "positive",
      relevance: 0.89,
    },
  ],
};

const WEATHER_BASES: Record<
  string,
  { tempRange: [number, number]; humRange: [number, number]; conditions: string[]; windRange: [number, number] }
> = {
  "New York": { tempRange: [12, 24], humRange: [40, 65], conditions: ["partly cloudy", "sunny", "overcast", "clear"], windRange: [8, 22] },
  London: { tempRange: [8, 16], humRange: [65, 85], conditions: ["overcast", "rainy", "cloudy", "drizzle"], windRange: [10, 25] },
  Tokyo: { tempRange: [16, 26], humRange: [45, 70], conditions: ["sunny", "partly cloudy", "clear", "cloudy"], windRange: [5, 15] },
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function jitter(center: number, spread: number): number {
  const raw = center + (Math.random() * 2 - 1) * spread;
  return Math.max(-1, Math.min(1, Number(raw.toFixed(3))));
}

function randBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function readQuery(body: unknown): unknown {
  if (!body || typeof body !== "object") return undefined;
  return (body as Record<string, unknown>).query;
}

export function validateQuery(body: unknown): string {
  const query = readQuery(body);
  if (typeof query !== "string") throw new QueryValidationError("Request body must include a string query");

  const trimmed = query.trim();
  if (!trimmed) throw new QueryValidationError("Query cannot be empty");
  if (trimmed.length > 128) throw new QueryValidationError("Query must be 128 characters or fewer");

  return trimmed;
}

export function generateSentiment(query: string): SentimentResponse {
  const ticker = query.toUpperCase();
  const base = SENTIMENT_BASES[ticker];
  const score = base ? jitter(base.center, base.spread) : jitter(0, 0.7);

  return {
    ticker,
    score,
    signal: score > 0.05 ? "bullish" : score < -0.05 ? "bearish" : "neutral",
    confidence: Number((0.55 + Math.random() * 0.4).toFixed(2)),
    sources: Math.floor(8 + Math.random() * 25),
    summary: base
      ? pickRandom(base.summaries)
      : `Market sentiment analysis for ${ticker} based on aggregated data sources.`,
  };
}

export function generateFinancial(query: string): FinancialResponse {
  const variants = FINANCIAL_VARIANTS[query];
  if (!variants) {
    return {
      topic: query,
      headline: `${query}: Recent developments and market implications`,
      summary: `Analysis of ${query} indicates mixed signals. Further monitoring is recommended.`,
      impact: pickRandom(["positive", "negative", "neutral"] as const),
      relevance: Number((0.6 + Math.random() * 0.3).toFixed(2)),
    };
  }

  const base = pickRandom(variants);
  return {
    topic: query,
    ...base,
    relevance: Number(Math.max(0, Math.min(1, base.relevance + (Math.random() * 0.1 - 0.05))).toFixed(2)),
  };
}

export function generateWeather(query: string): WeatherResponse {
  const base = WEATHER_BASES[query] ?? {
    tempRange: [10, 30] as [number, number],
    humRange: [40, 80] as [number, number],
    conditions: ["sunny", "cloudy", "rainy", "partly cloudy"],
    windRange: [5, 30] as [number, number],
  };

  const temp = randBetween(base.tempRange[0], base.tempRange[1]);
  const humidity = randBetween(base.humRange[0], base.humRange[1]);
  const wind = randBetween(base.windRange[0], base.windRange[1]);
  const conditions = pickRandom(base.conditions);

  return {
    city: query,
    temperature_c: temp,
    humidity_pct: humidity,
    conditions,
    wind_kph: wind,
    forecast: `${query}: ${conditions} at ${temp}C. Humidity ${humidity}%, wind ${wind} kph.`,
  };
}

export function generateDatasetData(dataset: DatasetType, query: string): DatasetResponse {
  switch (dataset) {
    case "sentiment":
      return generateSentiment(query);
    case "financial":
      return generateFinancial(query);
    case "weather":
      return generateWeather(query);
  }
}

export function createDatasetHandler(dataset: DatasetType, recorder?: ProvenanceRecorder) {
  return async (req: DatasetRequestLike, res: DatasetResponseLike): Promise<void> => {
    let query: string;

    try {
      query = validateQuery(req.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid query";
      res.status(400).json({ error: message });
      return;
    }

    try {
      const payload = generateDatasetData(dataset, query);
      res.status(200).json(payload);

      recordProvenanceBestEffort(req, dataset, query, recorder);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Server error";
      res.status(500).json({ error: message });
    }
  };
}

function recordProvenanceBestEffort(
  req: DatasetRequestLike,
  dataset: DatasetType,
  query: string,
  recorder?: ProvenanceRecorder,
): void {
  const buyer = extractBuyerAddressFromRequest(req);
  if (!buyer || !recorder) return;

  const metadata = DATASETS[dataset];
  try {
    void recorder.recordPurchase({
      buyer,
      dataset,
      datasetId: metadata.id,
      pricePaid: metadata.priceUsdMicro,
      query,
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[provenance] Failed to record ${dataset} purchase: ${message}`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[provenance] Failed to start ${dataset} purchase recording: ${message}`);
  }
}
