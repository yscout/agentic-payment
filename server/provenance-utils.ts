const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PAYER_KEYS = new Set(["from", "buyer", "payer", "sender", "account"]);

export interface PaymentRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  get?: (name: string) => string | undefined;
  header?: (name: string) => string | undefined;
  x402?: {
    paymentPayload?: unknown;
  };
  paymentPayload?: unknown;
}

export function isAddressLike(value: unknown): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

export function decodeBase64Json(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function getHeader(req: PaymentRequestLike, name: string): string | undefined {
  const viaGetter = req.get?.(name) ?? req.header?.(name);
  if (viaGetter) return viaGetter;

  const headers = req.headers ?? {};
  const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function findAddressByKey(value: unknown, seen = new Set<unknown>()): string | undefined {
  if (!value || typeof value !== "object" || seen.has(value)) return undefined;
  seen.add(value);

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PAYER_KEYS.has(key) && isAddressLike(nested)) return nested;
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findAddressByKey(nested, seen);
    if (found) return found;
  }

  return undefined;
}

export function extractBuyerAddressFromPaymentPayload(payload: unknown): string | undefined {
  const likelyPaths = [
    ["payload", "authorization", "from"],
    ["authorization", "from"],
    ["payload", "from"],
    ["from"],
    ["buyer"],
    ["payer"],
    ["sender"],
    ["account"],
  ];

  for (const path of likelyPaths) {
    const candidate = readPath(payload, path);
    if (isAddressLike(candidate)) return candidate;
  }

  return findAddressByKey(payload);
}

export function extractBuyerAddressFromRequest(req: PaymentRequestLike): string | undefined {
  const directPayloads = [req.x402?.paymentPayload, req.paymentPayload];
  for (const payload of directPayloads) {
    const buyer = extractBuyerAddressFromPaymentPayload(payload);
    if (buyer) return buyer;
  }

  const paymentHeader =
    getHeader(req, "x-payment") ??
    getHeader(req, "payment-signature") ??
    getHeader(req, "x-payment-signature");

  if (!paymentHeader) return undefined;

  try {
    return extractBuyerAddressFromPaymentPayload(decodeBase64Json(paymentHeader));
  } catch {
    return undefined;
  }
}
