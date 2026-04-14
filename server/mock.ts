/**
 * Mock Data Provider Server
 *
 * A standalone server that simulates Robot 2 (the data provider).
 * Returns realistic structured data for all 3 endpoints.
 * Does NOT require x402, blockchain, or any external services.
 *
 * Use this for development and demo when the real server (Person B)
 * isn't ready yet. The agent can hit this server and get real-looking
 * responses to build its report from.
 *
 * Run: npm run server:mock
 */

import http from "http";

const PORT = 4021;

interface SentimentResponse {
  ticker: string;
  score: number;
  signal: string;
  confidence: number;
  sources: number;
  summary: string;
}

interface FinancialResponse {
  topic: string;
  headline: string;
  summary: string;
  impact: string;
  relevance: number;
}

interface WeatherResponse {
  city: string;
  temperature_c: number;
  humidity_pct: number;
  conditions: string;
  wind_kph: number;
  forecast: string;
}

// Base sentiment data -- randomized on each request to simulate live market changes
const SENTIMENT_BASES: Record<string, { center: number; spread: number; summaries: string[] }> = {
  AAPL:  { center:  0.40, spread: 0.35, summaries: [
    "Apple shows strong momentum driven by iPhone 16 sales and services revenue growth.",
    "Apple sentiment mixed as China sales decline offsets strong services performance.",
    "Institutional investors cautiously optimistic on Apple's AI integration roadmap.",
  ]},
  TSLA:  { center: -0.15, spread: 0.50, summaries: [
    "Tesla faces headwinds from EV competition in China and margin compression.",
    "Robotaxi optimism offsets delivery miss concerns for Tesla bulls.",
    "Tesla sentiment volatile as Musk's political involvement divides investors.",
  ]},
  NVDA:  { center:  0.80, spread: 0.20, summaries: [
    "NVIDIA dominates AI chip demand with Blackwell architecture exceeding expectations.",
    "Data center revenue surge drives overwhelming bullish sentiment for NVIDIA.",
    "NVIDIA supply constraints create urgency; sentiment strongly positive despite export risks.",
  ]},
  GOOGL: { center:  0.20, spread: 0.40, summaries: [
    "Google Cloud growth accelerates but AI search cannibalization concerns persist.",
    "Regulatory pressure in EU weighs on Google sentiment despite strong ad revenue.",
    "Google's Gemini AI traction improving; Cloud profitability a positive catalyst.",
  ]},
  AMZN:  { center:  0.55, spread: 0.30, summaries: [
    "Amazon AWS maintains market leadership. Advertising segment grows 25% YoY.",
    "Amazon cost optimization improving margins; e-commerce recovery underway.",
    "AWS Bedrock AI platform adoption accelerating among enterprise clients.",
  ]},
  MSFT:  { center:  0.50, spread: 0.25, summaries: [
    "Microsoft Copilot adoption drives Office 365 upgrades. Azure growth exceeds expectations.",
    "Microsoft AI monetization strongest among big tech. Enterprise demand robust.",
    "Azure growth steady but Copilot revenue contribution still ramping.",
  ]},
  META:  { center:  0.30, spread: 0.35, summaries: [
    "Meta's ad revenue rebounds strongly. Reality Labs losses narrow slightly.",
    "Threads gaining traction as Twitter alternative; Meta sentiment improving.",
    "Meta AI investments questioned but advertising moat remains strong.",
  ]},
  BTC:   { center:  0.60, spread: 0.40, summaries: [
    "Bitcoin ETF inflows remain strong post-halving. Institutional adoption expanding.",
    "Bitcoin consolidating after rally; long-term holders accumulating at current levels.",
    "Bitcoin macro sentiment positive on rate cut expectations and ETF demand.",
  ]},
  ETH:   { center:  0.10, spread: 0.45, summaries: [
    "Ethereum faces competition from Solana on speed. L2 ecosystem grows but ETH price lags.",
    "ETH staking ETF approval boosts sentiment; DeFi activity recovering.",
    "Ethereum roadmap execution steady but market prefers faster L1 alternatives.",
  ]},
  SPY:   { center:  0.35, spread: 0.30, summaries: [
    "S&P 500 sentiment mildly bullish on soft landing expectations.",
    "Market breadth improving; rotation from mega-cap to mid-cap underway.",
    "S&P 500 concentration risk in Magnificent 7 noted; broadening rally expected.",
  ]},
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(center: number, spread: number): number {
  const raw = center + (Math.random() * 2 - 1) * spread;
  return Math.max(-1, Math.min(1, +raw.toFixed(3)));
}

function generateSentiment(ticker: string): SentimentResponse {
  const base = SENTIMENT_BASES[ticker];
  if (!base) return fallbackSentiment(ticker);

  const score = jitter(base.center, base.spread);
  return {
    ticker,
    score,
    signal: score > 0.05 ? "bullish" : score < -0.05 ? "bearish" : "neutral",
    confidence: +(0.55 + Math.random() * 0.40).toFixed(2),
    sources: Math.floor(8 + Math.random() * 25),
    summary: pickRandom(base.summaries),
  };
}

// Financial data with multiple variants per topic -- one is picked randomly each request
const FINANCIAL_VARIANTS: Record<string, Array<Omit<FinancialResponse, "topic">>> = {
  "Apple Q1 earnings": [
    { headline: "Apple Q1 Revenue Beats at $124.3B, Services Hit Record", summary: "Apple reported Q1 revenue of $124.3B, beating estimates by $2.1B. Services revenue hit an all-time high of $23.1B. iPhone revenue grew 6% YoY driven by iPhone 16 Pro demand.", impact: "positive", relevance: 0.95 },
    { headline: "Apple Q1 Mixed: iPhone Strong, China Weakness Persists", summary: "Apple beat Q1 estimates on iPhone 16 strength but Greater China revenue fell 11%. Services segment record high. Guidance cautious on tariff uncertainty.", impact: "neutral", relevance: 0.92 },
  ],
  "Tesla delivery numbers": [
    { headline: "Tesla Q1 Deliveries Fall 13% to 386,810 Vehicles", summary: "Tesla delivered 386,810 vehicles in Q1, below analyst expectations of 449,000. Energy storage grew 125% YoY. Margin pressure continues from price cuts.", impact: "negative", relevance: 0.92 },
    { headline: "Tesla Deliveries Miss Badly; Energy Storage Bright Spot", summary: "Q1 deliveries disappoint at 387K vs 449K expected. Cybertruck ramp slow. Energy division provides diversification; storage deployments at 10.4 GWh.", impact: "negative", relevance: 0.90 },
  ],
  "NVIDIA AI chip demand": [
    { headline: "NVIDIA Blackwell Demand Exceeds Supply Through 2026", summary: "NVIDIA reports Blackwell GPU demand outstripping supply well into 2026. Data center revenue grew 409% YoY to $18.4B. Export controls to China remain a headwind.", impact: "positive", relevance: 0.97 },
    { headline: "NVIDIA Crushes Estimates Again; AI Spending Shows No Slowdown", summary: "Data center revenue $18.4B, up 409% YoY. Every major cloud provider increasing NVIDIA orders. Blackwell backlog extends to late 2026.", impact: "positive", relevance: 0.96 },
  ],
  "Google cloud revenue growth": [
    { headline: "Google Cloud Revenue Grows 28% to $11.4B, Turns Profitable", summary: "Google Cloud achieved $11.4B quarterly revenue with $900M operating profit. AI workloads driving adoption. Vertex AI platform seeing strong uptake.", impact: "positive", relevance: 0.88 },
    { headline: "Google Cloud Profitability Milestone; AI Workloads Accelerate", summary: "First sustained quarterly profit for Cloud division. Enterprise AI adoption via Vertex platform exceeds internal targets. Competition with AWS intensifies.", impact: "positive", relevance: 0.87 },
  ],
  "Amazon AWS market share": [
    { headline: "AWS Maintains 31% Cloud Market Share, Growth Reaccelerates", summary: "AWS reported $25.0B quarterly revenue, growing 19% YoY. Market share stable at 31%. Bedrock AI platform adoption growing rapidly.", impact: "positive", relevance: 0.91 },
    { headline: "AWS Revenue Reaccelerates; Bedrock AI Platform Gaining Traction", summary: "AWS growth rate improves to 19% from 13% trough. Custom Trainium2 chips reduce customer costs. Enterprise migration pipeline expanding.", impact: "positive", relevance: 0.89 },
  ],
};

function generateFinancial(topic: string): FinancialResponse {
  const variants = FINANCIAL_VARIANTS[topic];
  if (!variants) return fallbackFinancial(topic);

  const base = pickRandom(variants);
  return {
    topic,
    ...base,
    relevance: +(base.relevance + (Math.random() * 0.1 - 0.05)).toFixed(2),
  };
}

// Weather bases with ranges -- randomized each request
const WEATHER_BASES: Record<string, { tempRange: [number, number]; humRange: [number, number]; conditions: string[]; windRange: [number, number] }> = {
  "New York":      { tempRange: [12, 24], humRange: [40, 65], conditions: ["partly cloudy", "sunny", "overcast", "clear"], windRange: [8, 22] },
  "San Francisco": { tempRange: [11, 19], humRange: [60, 80], conditions: ["foggy", "partly cloudy", "sunny", "cloudy"], windRange: [15, 30] },
  "London":        { tempRange: [8, 16],  humRange: [65, 85], conditions: ["overcast", "rainy", "cloudy", "drizzle", "partly cloudy"], windRange: [10, 25] },
  "Tokyo":         { tempRange: [16, 26], humRange: [45, 70], conditions: ["sunny", "partly cloudy", "clear", "cloudy"], windRange: [5, 15] },
  "Singapore":     { tempRange: [28, 34], humRange: [75, 90], conditions: ["thunderstorms", "sunny", "humid", "partly cloudy"], windRange: [5, 18] },
  "Berlin":        { tempRange: [8, 18],  humRange: [50, 75], conditions: ["cloudy", "partly cloudy", "rainy", "overcast"], windRange: [12, 28] },
  "Sydney":        { tempRange: [16, 24], humRange: [45, 65], conditions: ["sunny", "partly cloudy", "clear", "windy"], windRange: [10, 22] },
  "Toronto":       { tempRange: [4, 16],  humRange: [50, 75], conditions: ["partly cloudy", "cloudy", "sunny", "windy"], windRange: [15, 30] },
};

function randBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function generateWeather(city: string): WeatherResponse {
  const base = WEATHER_BASES[city];
  if (!base) return fallbackWeather(city);

  const temp = randBetween(base.tempRange[0], base.tempRange[1]);
  const humidity = randBetween(base.humRange[0], base.humRange[1]);
  const conditions = pickRandom(base.conditions);
  const wind = randBetween(base.windRange[0], base.windRange[1]);

  return {
    city,
    temperature_c: temp,
    humidity_pct: humidity,
    conditions,
    wind_kph: wind,
    forecast: `${city}: ${conditions} at ${temp}°C. Humidity ${humidity}%, wind ${wind} kph. Conditions typical for the season.`,
  };
}

function fallbackSentiment(query: string): SentimentResponse {
  return {
    ticker: query,
    score: +(Math.random() * 2 - 1).toFixed(3),
    signal: Math.random() > 0.5 ? "bullish" : "bearish",
    confidence: +(0.5 + Math.random() * 0.4).toFixed(2),
    sources: Math.floor(5 + Math.random() * 20),
    summary: `Market sentiment analysis for ${query} based on aggregated data sources.`,
  };
}

function fallbackFinancial(query: string): FinancialResponse {
  return {
    topic: query,
    headline: `${query}: Recent developments and outlook`,
    summary: `Analysis of ${query} indicates mixed signals. Further monitoring recommended.`,
    impact: ["positive", "negative", "neutral"][Math.floor(Math.random() * 3)],
    relevance: +(0.6 + Math.random() * 0.3).toFixed(2),
  };
}

function fallbackWeather(query: string): WeatherResponse {
  return {
    city: query,
    temperature_c: Math.floor(10 + Math.random() * 20),
    humidity_pct: Math.floor(40 + Math.random() * 40),
    conditions: ["sunny", "cloudy", "rainy", "partly cloudy"][Math.floor(Math.random() * 4)],
    wind_kph: Math.floor(5 + Math.random() * 30),
    forecast: `${query}: Moderate conditions expected. Check local forecasts for detailed outlook.`,
  };
}

function parseBody(req: http.IncomingMessage): Promise<{ query?: string }> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-PAYMENT");
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const { query } = await parseBody(req);
  const q = query || "";
  const ts = new Date().toISOString().slice(11, 19);

  if (req.url === "/api/data/sentiment") {
    const response = generateSentiment(q);
    console.log(`[${ts}] sentiment -> "${q}" | score: ${response.score} | ${response.signal}`);
    res.writeHead(200);
    res.end(JSON.stringify(response));
    return;
  }

  if (req.url === "/api/data/financial") {
    const response = generateFinancial(q);
    console.log(`[${ts}] financial -> "${q}" | impact: ${response.impact}`);
    res.writeHead(200);
    res.end(JSON.stringify(response));
    return;
  }

  if (req.url === "/api/data/weather") {
    const response = generateWeather(q);
    console.log(`[${ts}] weather  -> "${q}" | ${response.temperature_c}°C ${response.conditions}`);
    res.writeHead(200);
    res.end(JSON.stringify(response));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Unknown endpoint" }));
});

server.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  MOCK DATA PROVIDER (Robot 2)                              ║");
  console.log("║  Serving prepared data on port 4021                        ║");
  console.log("║  No x402 payment required (mock mode)                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Endpoints:");
  console.log("  POST /api/data/sentiment  -> Market sentiment for stocks");
  console.log("  POST /api/data/financial  -> Financial analysis and news");
  console.log("  POST /api/data/weather    -> Weather at trading hubs");
  console.log("");
  console.log("Waiting for agent requests...\n");
});
