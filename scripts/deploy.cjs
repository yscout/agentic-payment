const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();

  console.log("Deploying DataMarketplace...");
  console.log("Deployer / owner:", deployer.address);

  const DataMarketplace = await ethers.getContractFactory("DataMarketplace");
  const marketplace = await DataMarketplace.deploy();

  await marketplace.waitForDeployment();

  const marketplaceAddress = await marketplace.getAddress();

  console.log("DataMarketplace deployed to:", marketplaceAddress);

  const datasets = [
    {
      name: "sentiment",
      description: "Market sentiment analysis",
      priceUsd: 1000,
    },
    {
      name: "financial",
      description: "Financial news summary",
      priceUsd: 2000,
    },
    {
      name: "weather",
      description: "Weather forecast data",
      priceUsd: 500,
    },
  ];

  for (const dataset of datasets) {
    const tx = await marketplace.registerDataset(
      dataset.name,
      dataset.description,
      dataset.priceUsd
    );
    await tx.wait();

    console.log(
      `Registered dataset: ${dataset.name} (${dataset.priceUsd} micro-USD)`
    );
  }

  const providerRecorderAddress = process.env.PROVIDER_RECORDER_ADDRESS;

  if (providerRecorderAddress) {
    const tx = await marketplace.setRecorder(providerRecorderAddress, true);
    await tx.wait();

    console.log("Authorized provider recorder:", providerRecorderAddress);
  } else {
    console.log(
      "No PROVIDER_RECORDER_ADDRESS set; skipping recorder authorization"
    );
  }

  const datasetCount = await marketplace.getDatasetCount();

  console.log("Dataset count:", datasetCount.toString());
  console.log("");
  console.log("Add this to .env:");
  console.log(`DATA_MARKETPLACE_ADDRESS=${marketplaceAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});