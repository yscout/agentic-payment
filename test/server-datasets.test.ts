import test from "node:test";
import assert from "node:assert/strict";

import {
  createDatasetHandler,
  generateDatasetData,
  validateQuery,
  type RecordPurchaseInput,
} from "../server/datasets.js";

function createMockResponse() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
    },
  };
}

test("validateQuery trims a valid query", () => {
  assert.equal(validateQuery({ query: "  AAPL  " }), "AAPL");
});

test("validateQuery rejects missing, empty, and too-long queries", () => {
  assert.throws(() => validateQuery({}), /string query/);
  assert.throws(() => validateQuery({ query: "   " }), /empty/);
  assert.throws(() => validateQuery({ query: "A".repeat(129) }), /128/);
});

test("generateDatasetData returns the exact response shape expected by the agent", () => {
  const sentiment = generateDatasetData("sentiment", "AAPL");
  assert.equal("ticker" in sentiment, true);
  assert.equal("score" in sentiment, true);
  assert.equal("signal" in sentiment, true);
  assert.equal("confidence" in sentiment, true);
  assert.equal("sources" in sentiment, true);
  assert.equal("summary" in sentiment, true);

  const financial = generateDatasetData("financial", "Apple Q1 earnings");
  assert.equal("topic" in financial, true);
  assert.equal("headline" in financial, true);
  assert.equal("summary" in financial, true);
  assert.equal("impact" in financial, true);
  assert.equal("relevance" in financial, true);

  const weather = generateDatasetData("weather", "Tokyo");
  assert.equal("city" in weather, true);
  assert.equal("temperature_c" in weather, true);
  assert.equal("humidity_pct" in weather, true);
  assert.equal("conditions" in weather, true);
  assert.equal("wind_kph" in weather, true);
  assert.equal("forecast" in weather, true);
});

test("dataset handler returns 400 on invalid query without recording provenance", async () => {
  const recorded: RecordPurchaseInput[] = [];
  const handler = createDatasetHandler("sentiment", {
    async recordPurchase(input) {
      recorded.push(input);
    },
  });
  const res = createMockResponse();

  await handler({ body: { query: "" } }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(recorded, []);
});

test("dataset handler records provenance when a paid request includes a buyer address", async () => {
  const buyer = "0x1111111111111111111111111111111111111111";
  const paymentPayload = Buffer.from(
    JSON.stringify({ payload: { authorization: { from: buyer } } }),
  ).toString("base64");
  const recorded: RecordPurchaseInput[] = [];
  const handler = createDatasetHandler("weather", {
    async recordPurchase(input) {
      recorded.push(input);
    },
  });
  const res = createMockResponse();

  await handler(
    {
      body: { query: "Tokyo" },
      headers: { "x-payment": paymentPayload },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(recorded.length, 1);
  assert.deepEqual(recorded[0], {
    buyer,
    dataset: "weather",
    datasetId: 2,
    pricePaid: 500,
    query: "Tokyo",
  });
});
