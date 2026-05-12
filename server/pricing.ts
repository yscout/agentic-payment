export const DATASETS = {
  sentiment: {
    id: 0,
    path: "/api/data/sentiment",
    name: "sentiment",
    description: "Market sentiment analysis",
    price: "0.000001 ETH",
    priceWei: 1_000_000_000_000n,
  },
  financial: {
    id: 1,
    path: "/api/data/financial",
    name: "financial",
    description: "Financial news summary",
    price: "0.000002 ETH",
    priceWei: 2_000_000_000_000n,
  },
  weather: {
    id: 2,
    path: "/api/data/weather",
    name: "weather",
    description: "Weather forecast data",
    price: "0.0000005 ETH",
    priceWei: 500_000_000_000n,
  },
} as const;

export type DatasetType = keyof typeof DATASETS;

export function getDatasetTypeByPath(path: string): DatasetType | undefined {
  return (Object.keys(DATASETS) as DatasetType[]).find(
    (dataset) => DATASETS[dataset].path === path,
  );
}
