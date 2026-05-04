const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const marketplaceAddress = process.env.DATA_MARKETPLACE_ADDRESS;
  const recorderAddress = process.env.PROVIDER_RECORDER_ADDRESS;

  if (!marketplaceAddress) {
    throw new Error("Missing DATA_MARKETPLACE_ADDRESS in .env");
  }

  if (!recorderAddress) {
    throw new Error("Missing PROVIDER_RECORDER_ADDRESS in .env");
  }

  const [owner] = await hre.ethers.getSigners();

  console.log("Using owner wallet:", owner.address);
  console.log("DataMarketplace:", marketplaceAddress);
  console.log("Authorizing recorder:", recorderAddress);

  const marketplace = await hre.ethers.getContractAt(
    "DataMarketplace",
    marketplaceAddress
  );

  const tx = await marketplace.setRecorder(recorderAddress, true);
  console.log("Transaction submitted:", tx.hash);

  await tx.wait();

  const isAuthorized = await marketplace.authorizedRecorders(recorderAddress);

  console.log("Recorder authorized:", isAuthorized);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});