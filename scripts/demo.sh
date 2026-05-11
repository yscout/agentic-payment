#!/usr/bin/env bash
set -euo pipefail

# Load .env variables
set -a
source .env 2>/dev/null || true
set +a

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  AGENTIC PAYMENT SYSTEM -- LIVE DEMO                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Kill anything already on port 4021
lsof -ti :4021 | xargs kill -9 2>/dev/null || true
sleep 1

# Start the data provider server in background
echo "[demo] Starting data provider server..."
npx tsx server/index.ts &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# Wait for server to be ready
sleep 3

echo ""
echo "[demo] Running autonomous consumer agent..."
echo ""

# Run agent (blocks until complete)
npx tsx agent/index.ts

echo ""

# Open BaseScan to show on-chain purchases
if [ -n "${DATA_MARKETPLACE_ADDRESS:-}" ]; then
  BASESCAN="https://sepolia.basescan.org/address/${DATA_MARKETPLACE_ADDRESS}#events"
  echo "[demo] Opening DataMarketplace on BaseScan: $BASESCAN"
  open "$BASESCAN" 2>/dev/null || xdg-open "$BASESCAN" 2>/dev/null || echo "      Visit: $BASESCAN"
else
  echo "[demo] DATA_MARKETPLACE_ADDRESS not set -- skipping BaseScan"
fi
