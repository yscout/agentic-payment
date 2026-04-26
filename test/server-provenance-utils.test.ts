import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeBase64Json,
  extractBuyerAddressFromPaymentPayload,
  extractBuyerAddressFromRequest,
  isAddressLike,
} from "../server/provenance-utils.js";

test("isAddressLike validates EVM addresses", () => {
  assert.equal(isAddressLike("0x1111111111111111111111111111111111111111"), true);
  assert.equal(isAddressLike("0xabc"), false);
  assert.equal(isAddressLike(undefined), false);
});

test("decodeBase64Json decodes x402 payment headers", () => {
  const header = Buffer.from(JSON.stringify({ ok: true })).toString("base64");
  assert.deepEqual(decodeBase64Json(header), { ok: true });
});

test("extractBuyerAddressFromPaymentPayload supports exact EVM authorization payloads", () => {
  const buyer = "0x2222222222222222222222222222222222222222";
  assert.equal(
    extractBuyerAddressFromPaymentPayload({
      payload: {
        authorization: {
          from: buyer,
        },
      },
    }),
    buyer,
  );
});

test("extractBuyerAddressFromRequest reads x-payment header", () => {
  const buyer = "0x3333333333333333333333333333333333333333";
  const header = Buffer.from(
    JSON.stringify({ payload: { authorization: { from: buyer } } }),
  ).toString("base64");

  assert.equal(
    extractBuyerAddressFromRequest({
      headers: {
        "x-payment": header,
      },
    }),
    buyer,
  );
});

test("extractBuyerAddressFromRequest returns undefined for missing or invalid payment data", () => {
  assert.equal(extractBuyerAddressFromRequest({ headers: {} }), undefined);
  assert.equal(
    extractBuyerAddressFromRequest({
      headers: {
        "x-payment": "not-base64-json",
      },
    }),
    undefined,
  );
});
