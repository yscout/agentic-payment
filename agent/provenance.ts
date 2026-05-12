import { ethers } from "ethers";
import { AGENT_CONFIG } from "./config.js";

const DATA_MARKETPLACE_ABI = [
  "function getPurchasesByBuyer(address buyer) view returns (uint256[])",
  "function getPurchase(uint256 id) view returns (tuple(address buyer, uint256 datasetId, uint256 pricePaid, bytes32 queryHash, uint256 timestamp))",
  "function getDataset(uint256 id) view returns (tuple(string name, string description, uint256 price, bool active))",
  "function getDatasetCount() view returns (uint256)",
  "function getTotalPurchases() view returns (uint256)",
];

interface Purchase {
  buyer: string;
  datasetId: bigint;
  pricePaid: bigint;
  queryHash: string;
  timestamp: bigint;
}

interface Dataset {
  name: string;
  description: string;
  price: bigint;
  active: boolean;
}

export async function verifyPurchaseHistory(
  buyerAddress: string,
): Promise<void> {
  if (!AGENT_CONFIG.marketplaceAddress) {
    console.log(
      "\n[Provenance] No DataMarketplace address configured -- skipping on-chain verification",
    );
    console.log(
      "[Provenance] Set DATA_MARKETPLACE_ADDRESS in .env once Person A deploys the contract",
    );
    return;
  }

  console.log("\n========================================");
  console.log("  ON-CHAIN PURCHASE VERIFICATION");
  console.log("========================================");

  const provider = new ethers.JsonRpcProvider(AGENT_CONFIG.rpcUrl);
  const contract = new ethers.Contract(
    AGENT_CONFIG.marketplaceAddress,
    DATA_MARKETPLACE_ABI,
    provider,
  );

  try {
    const datasetCount: bigint = await contract.getDatasetCount();
    console.log(`\nRegistered datasets on-chain: ${datasetCount}`);

    for (let i = 0; i < Number(datasetCount); i++) {
      const ds: Dataset = await contract.getDataset(i);
      console.log(`  [${i}] ${ds.name} -- ${ethers.formatEther(ds.price)} ETH`);
    }

    const purchaseIds: bigint[] =
      await contract.getPurchasesByBuyer(buyerAddress);
    console.log(
      `\nPurchases by this agent (${buyerAddress}): ${purchaseIds.length}`,
    );

    let totalSpent = 0n;
    for (const id of purchaseIds) {
      const p: Purchase = await contract.getPurchase(id);
      const datasetName =
        Number(p.datasetId) < Number(datasetCount)
          ? ((await contract.getDataset(Number(p.datasetId))) as Dataset).name
          : `dataset#${p.datasetId}`;

      const priceEth = ethers.formatEther(p.pricePaid);
      const time = new Date(Number(p.timestamp) * 1000).toISOString();

      console.log(`  #${id}: ${datasetName} | ${priceEth} ETH | ${time}`);
      totalSpent += p.pricePaid;
    }

    console.log(
      `\nTotal spent (on-chain verified): ${ethers.formatEther(totalSpent)} ETH`,
    );
    const isLocalChain = /127\.0\.0\.1|localhost/.test(AGENT_CONFIG.rpcUrl);
    if (!isLocalChain) {
      console.log(
        `View on BaseScan: https://sepolia.basescan.org/address/${AGENT_CONFIG.marketplaceAddress}#events`,
      );
    }
  } catch (err) {
    console.error("[Provenance] Failed to read contract:", err);
  }
}
