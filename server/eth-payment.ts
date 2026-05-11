import type { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";

export interface EthRouteConfig {
  amountWei: bigint;
  payTo: string;
}

export function createEthPaymentMiddleware(
  routes: Record<string, EthRouteConfig>,
  provider: ethers.JsonRpcProvider,
) {
  const usedTxHashes = new Set<string>();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const routeKey = `${req.method} ${req.path}`;
    const config = routes[routeKey];

    if (!config) {
      next();
      return;
    }

    const txHash = req.headers["x-payment-tx"] as string | undefined;

    if (!txHash) {
      res.status(402).json({
        error: "Payment required",
        payTo: config.payTo,
        amount: ethers.formatEther(config.amountWei),
        currency: "ETH",
        network: "eip155:84532",
        instructions: `Send ${ethers.formatEther(config.amountWei)} ETH to ${config.payTo} and include the tx hash in the X-Payment-Tx header`,
      });
      return;
    }

    if (usedTxHashes.has(txHash)) {
      res.status(402).json({ error: "Transaction already used for a previous request" });
      return;
    }

    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        res.status(402).json({ error: "Transaction not found on-chain" });
        return;
      }
      if (!tx.to || tx.to.toLowerCase() !== config.payTo.toLowerCase()) {
        res.status(402).json({ error: "Transaction sent to wrong address" });
        return;
      }
      if (tx.value < config.amountWei) {
        res.status(402).json({
          error: "Insufficient payment",
          required: ethers.formatEther(config.amountWei) + " ETH",
          received: ethers.formatEther(tx.value) + " ETH",
        });
        return;
      }
      usedTxHashes.add(txHash);
      next();
    } catch (err) {
      res.status(402).json({ error: "Could not verify payment", detail: String(err) });
    }
  };
}
