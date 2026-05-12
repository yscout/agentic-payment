import { ethers } from "ethers";
import { DATASETS, type DatasetType } from "./pricing.js";
import type { ProvenanceRecorder, RecordPurchaseInput } from "./datasets.js";

const DATA_MARKETPLACE_ABI = [
  "function recordPurchase(address buyer, uint256 datasetId, uint256 pricePaid, bytes32 queryHash) external",
];

export interface ProvenanceConfig {
  rpcUrl: string;
  marketplaceAddress: string;
  providerPrivateKey: string;
}

export interface ContractLike {
  recordPurchase(
    buyer: string,
    datasetId: number,
    pricePaid: bigint,
    queryHash: string,
  ): Promise<{ hash?: string; wait?: (confirmations?: number) => Promise<unknown> }>;
}

export function buildPurchaseArgs(input: RecordPurchaseInput): [string, number, bigint, string] {
  const metadata = DATASETS[input.dataset];
  const datasetId = input.datasetId ?? metadata.id;
  const pricePaid = input.pricePaid ?? metadata.priceWei;
  const queryHash = ethers.keccak256(ethers.toUtf8Bytes(input.query));

  return [input.buyer, datasetId, pricePaid, queryHash];
}

export class ContractProvenanceRecorder implements ProvenanceRecorder {
  private readonly contract: ContractLike;

  constructor(contract: ContractLike) {
    this.contract = contract;
  }

  async recordPurchase(input: RecordPurchaseInput): Promise<void> {
    const tx = await this.contract.recordPurchase(...buildPurchaseArgs(input));
    if (tx.hash) console.log(`[provenance] Purchase submitted: ${tx.hash}`);
    await tx.wait?.(1);
  }
}

export class NoopProvenanceRecorder implements ProvenanceRecorder {
  private warned = false;

  async recordPurchase(): Promise<void> {
    if (this.warned) return;
    this.warned = true;
    console.warn("[provenance] DATA_MARKETPLACE_ADDRESS or PROVIDER_PRIVATE_KEY missing; skipping on-chain recording");
  }
}

export function createProvenanceRecorder(config: ProvenanceConfig): ProvenanceRecorder {
  if (!config.marketplaceAddress || !config.providerPrivateKey) {
    return new NoopProvenanceRecorder();
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.providerPrivateKey, provider);
  const contract = new ethers.Contract(config.marketplaceAddress, DATA_MARKETPLACE_ABI, signer) as unknown as ContractLike;

  return new ContractProvenanceRecorder(contract);
}
