export const DATASETS = {
  sentiment: {
    id: 0,
    path: "/api/data/sentiment",
    name: "sentiment",
    description: "Market sentiment analysis",
    price: "$0.001",
    priceUsdMicro: 1000,
  },
  financial: {
    id: 1,
    path: "/api/data/financial",
    name: "financial",
    description: "Financial news summary",
    price: "$0.002",
    priceUsdMicro: 2000,
  },
  weather: {
    id: 2,
    path: "/api/data/weather",
    name: "weather",
    description: "Weather forecast data",
    price: "$0.0005",
    priceUsdMicro: 500,
  },
} as const;

export type DatasetType = keyof typeof DATASETS;

export function getDatasetTypeByPath(path: string): DatasetType | undefined {
  return (Object.keys(DATASETS) as DatasetType[]).find(
    (dataset) => DATASETS[dataset].path === path,
  );
}
