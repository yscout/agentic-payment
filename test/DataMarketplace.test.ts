import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("DataMarketplace", function () {
  async function deployFixture() {
    const [owner, recorder, buyer, other] = await ethers.getSigners();

    const DataMarketplace = await ethers.getContractFactory("DataMarketplace");
    const marketplace = await DataMarketplace.deploy();

    return {
      marketplace,
      owner,
      recorder,
      buyer,
      other,
    };
  }

  async function deployWithDatasetsFixture() {
    const fixture = await deployFixture();
    const { marketplace } = fixture;

    await marketplace.registerDataset(
      "sentiment",
      "Market sentiment analysis",
      1000
    );

    await marketplace.registerDataset(
      "financial",
      "Financial news summary",
      2000
    );

    await marketplace.registerDataset(
      "weather",
      "Weather forecast data",
      500
    );

    return fixture;
  }

  describe("Deployment", function () {
    it("sets the deployer as owner", async function () {
      const { marketplace, owner } = await deployFixture();

      expect(await marketplace.owner()).to.equal(owner.address);
    });
  });

  describe("Dataset registration", function () {
    it("allows owner to register datasets", async function () {
      const { marketplace } = await deployFixture();

      await expect(
        marketplace.registerDataset(
          "sentiment",
          "Market sentiment analysis",
          1000
        )
      )
        .to.emit(marketplace, "DatasetRegistered")
        .withArgs(0, "sentiment", 1000);

      expect(await marketplace.getDatasetCount()).to.equal(1);

      const dataset = await marketplace.getDataset(0);

      expect(dataset.name).to.equal("sentiment");
      expect(dataset.description).to.equal("Market sentiment analysis");
      expect(dataset.price).to.equal(1000);
      expect(dataset.active).to.equal(true);
    });

    it("registers datasets in the required order", async function () {
      const { marketplace } = await deployWithDatasetsFixture();

      const sentiment = await marketplace.getDataset(0);
      const financial = await marketplace.getDataset(1);
      const weather = await marketplace.getDataset(2);

      expect(sentiment.name).to.equal("sentiment");
      expect(sentiment.price).to.equal(1000);

      expect(financial.name).to.equal("financial");
      expect(financial.price).to.equal(2000);

      expect(weather.name).to.equal("weather");
      expect(weather.price).to.equal(500);

      expect(await marketplace.getDatasetCount()).to.equal(3);
    });

    it("prevents non-owner from registering datasets", async function () {
      const { marketplace, other } = await deployFixture();

      await expect(
        marketplace
          .connect(other)
          .registerDataset("sentiment", "Market sentiment analysis", 1000)
      ).to.be.revertedWith("DataMarketplace: not owner");
    });

    it("rejects empty dataset names", async function () {
      const { marketplace } = await deployFixture();

      await expect(
        marketplace.registerDataset("", "Missing name", 1000)
      ).to.be.revertedWith("DataMarketplace: empty name");
    });

    it("rejects zero dataset price", async function () {
      const { marketplace } = await deployFixture();

      await expect(
        marketplace.registerDataset("sentiment", "Market sentiment analysis", 0)
      ).to.be.revertedWith("DataMarketplace: zero price");
    });

    it("reverts when reading invalid dataset id", async function () {
      const { marketplace } = await deployWithDatasetsFixture();

      await expect(marketplace.getDataset(3)).to.be.revertedWith(
        "DataMarketplace: invalid dataset"
      );
    });
  });

  describe("Recorder authorization", function () {
    it("allows owner to authorize a recorder", async function () {
      const { marketplace, recorder } = await deployFixture();

      await expect(marketplace.setRecorder(recorder.address, true))
        .to.emit(marketplace, "RecorderAuthorizationUpdated")
        .withArgs(recorder.address, true);

      expect(await marketplace.authorizedRecorders(recorder.address)).to.equal(
        true
      );
    });

    it("allows owner to revoke a recorder", async function () {
      const { marketplace, recorder } = await deployFixture();

      await marketplace.setRecorder(recorder.address, true);
      await marketplace.setRecorder(recorder.address, false);

      expect(await marketplace.authorizedRecorders(recorder.address)).to.equal(
        false
      );
    });

    it("prevents non-owner from authorizing recorder", async function () {
      const { marketplace, recorder, other } = await deployFixture();

      await expect(
        marketplace.connect(other).setRecorder(recorder.address, true)
      ).to.be.revertedWith("DataMarketplace: not owner");
    });

    it("rejects zero address recorder", async function () {
      const { marketplace } = await deployFixture();

      await expect(
        marketplace.setRecorder(ethers.ZeroAddress, true)
      ).to.be.revertedWith("DataMarketplace: zero recorder");
    });
  });

  describe("Purchase recording", function () {
    it("allows owner to record a purchase", async function () {
      const { marketplace, buyer } = await deployWithDatasetsFixture();

      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("AAPL"));

      const tx = await marketplace.recordPurchase(
        buyer.address,
        0,
        1000,
        queryHash
      );

      await expect(tx)
        .to.emit(marketplace, "PurchaseRecorded")
        .withArgs(0, buyer.address, 0);

      expect(await marketplace.getTotalPurchases()).to.equal(1);

      const purchase = await marketplace.getPurchase(0);

      expect(purchase.buyer).to.equal(buyer.address);
      expect(purchase.datasetId).to.equal(0);
      expect(purchase.pricePaid).to.equal(1000);
      expect(purchase.queryHash).to.equal(queryHash);
      expect(purchase.timestamp).to.be.greaterThan(0);
    });

    it("allows authorized recorder to record a purchase", async function () {
      const { marketplace, recorder, buyer } =
        await deployWithDatasetsFixture();

      await marketplace.setRecorder(recorder.address, true);

      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("TSLA"));

      await expect(
        marketplace
          .connect(recorder)
          .recordPurchase(buyer.address, 1, 2000, queryHash)
      )
        .to.emit(marketplace, "PurchaseRecorded")
        .withArgs(0, buyer.address, 1);
    });

    it("prevents unauthorized address from recording a purchase", async function () {
      const { marketplace, other, buyer } = await deployWithDatasetsFixture();

      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("AAPL"));

      await expect(
        marketplace
          .connect(other)
          .recordPurchase(buyer.address, 0, 1000, queryHash)
      ).to.be.revertedWith("DataMarketplace: not authorized recorder");
    });

    it("tracks purchases by buyer", async function () {
      const { marketplace, buyer } = await deployWithDatasetsFixture();

      const hashAAPL = ethers.keccak256(ethers.toUtf8Bytes("AAPL"));
      const hashNVDA = ethers.keccak256(ethers.toUtf8Bytes("NVDA"));

      await marketplace.recordPurchase(buyer.address, 0, 1000, hashAAPL);
      await marketplace.recordPurchase(buyer.address, 1, 2000, hashNVDA);

      const purchaseIds = await marketplace.getPurchasesByBuyer(buyer.address);

      expect(purchaseIds.length).to.equal(2);
      expect(purchaseIds[0]).to.equal(0);
      expect(purchaseIds[1]).to.equal(1);
    });

    it("tracks purchases separately for different buyers", async function () {
      const { marketplace, buyer, other } = await deployWithDatasetsFixture();

      const hashAAPL = ethers.keccak256(ethers.toUtf8Bytes("AAPL"));
      const hashTSLA = ethers.keccak256(ethers.toUtf8Bytes("TSLA"));

      await marketplace.recordPurchase(buyer.address, 0, 1000, hashAAPL);
      await marketplace.recordPurchase(other.address, 0, 1000, hashTSLA);

      const buyerPurchases = await marketplace.getPurchasesByBuyer(
        buyer.address
      );
      const otherPurchases = await marketplace.getPurchasesByBuyer(
        other.address
      );

      expect(buyerPurchases.length).to.equal(1);
      expect(otherPurchases.length).to.equal(1);

      expect(buyerPurchases[0]).to.equal(0);
      expect(otherPurchases[0]).to.equal(1);
    });

    it("rejects zero buyer address", async function () {
      const { marketplace } = await deployWithDatasetsFixture();

      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("AAPL"));

      await expect(
        marketplace.recordPurchase(ethers.ZeroAddress, 0, 1000, queryHash)
      ).to.be.revertedWith("DataMarketplace: zero buyer");
    });

    it("rejects invalid dataset id", async function () {
      const { marketplace, buyer } = await deployWithDatasetsFixture();

      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("AAPL"));

      await expect(
        marketplace.recordPurchase(buyer.address, 3, 1000, queryHash)
      ).to.be.revertedWith("DataMarketplace: invalid dataset");
    });

    it("rejects zero purchase price", async function () {
      const { marketplace, buyer } = await deployWithDatasetsFixture();

      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("AAPL"));

      await expect(
        marketplace.recordPurchase(buyer.address, 0, 0, queryHash)
      ).to.be.revertedWith("DataMarketplace: zero price");
    });

    it("reverts when reading invalid purchase id", async function () {
      const { marketplace } = await deployWithDatasetsFixture();

      await expect(marketplace.getPurchase(0)).to.be.revertedWith(
        "DataMarketplace: invalid purchase"
      );
    });

    it("records wei-scale purchases that roundtrip exactly (no USD lie)", async function () {
      const { marketplace, owner } = await deployFixture();

      // Real wei values matching server/pricing.ts
      const sentimentWei = 1_000_000_000_000n; // 0.000001 ETH
      const financialWei = 2_000_000_000_000n; // 0.000002 ETH
      const weatherWei = 500_000_000_000n; //   0.0000005 ETH

      await marketplace.registerDataset("sentiment", "", sentimentWei);
      await marketplace.registerDataset("financial", "", financialWei);
      await marketplace.registerDataset("weather", "", weatherWei);

      const sentimentDs = await marketplace.getDataset(0);
      const weatherDs = await marketplace.getDataset(2);
      expect(sentimentDs.price).to.equal(sentimentWei);
      expect(weatherDs.price).to.equal(weatherWei);
      expect(ethers.formatEther(sentimentDs.price)).to.equal("0.000001");
      expect(ethers.formatEther(weatherDs.price)).to.equal("0.0000005");

      const hash = ethers.keccak256(ethers.toUtf8Bytes("AAPL"));
      await marketplace.recordPurchase(owner.address, 0, sentimentWei, hash);
      await marketplace.recordPurchase(owner.address, 1, financialWei, hash);
      await marketplace.recordPurchase(owner.address, 2, weatherWei, hash);

      const purchaseIds = await marketplace.getPurchasesByBuyer(owner.address);
      const p0 = await marketplace.getPurchase(purchaseIds[0]);
      const p1 = await marketplace.getPurchase(purchaseIds[1]);
      const p2 = await marketplace.getPurchase(purchaseIds[2]);

      expect(p0.pricePaid).to.equal(sentimentWei);
      expect(p1.pricePaid).to.equal(financialWei);
      expect(p2.pricePaid).to.equal(weatherWei);

      const totalWei = p0.pricePaid + p1.pricePaid + p2.pricePaid;
      expect(totalWei).to.equal(3_500_000_000_000n);
      expect(ethers.formatEther(totalWei)).to.equal("0.0000035");
    });
  });
});