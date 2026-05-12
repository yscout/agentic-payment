// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DataMarketplace {
    address public owner;

    struct Dataset {
        string name;
        string description;
        uint256 price; // in wei (native token, e.g. ETH on Base Sepolia)
        bool active;
    }

    struct Purchase {
        address buyer;
        uint256 datasetId;
        uint256 pricePaid; // in wei
        bytes32 queryHash;
        uint256 timestamp;
    }

    Dataset[] private datasets;
    Purchase[] private purchases;

    mapping(address => uint256[]) private purchasesByBuyer;
    mapping(address => bool) public authorizedRecorders;

    event DatasetRegistered(uint256 indexed id, string name, uint256 price);

    event PurchaseRecorded(
        uint256 indexed purchaseId,
        address indexed buyer,
        uint256 indexed datasetId
    );

    event RecorderAuthorizationUpdated(
        address indexed recorder,
        bool authorized
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "DataMarketplace: not owner");
        _;
    }

    modifier onlyRecorderOrOwner() {
        require(
            msg.sender == owner || authorizedRecorders[msg.sender],
            "DataMarketplace: not authorized recorder"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setRecorder(address recorder, bool authorized) external onlyOwner {
        require(recorder != address(0), "DataMarketplace: zero recorder");

        authorizedRecorders[recorder] = authorized;

        emit RecorderAuthorizationUpdated(recorder, authorized);
    }

    function registerDataset(
        string calldata name,
        string calldata description,
        uint256 price
    ) external onlyOwner {
        require(bytes(name).length > 0, "DataMarketplace: empty name");
        require(price > 0, "DataMarketplace: zero price");

        uint256 id = datasets.length;

        datasets.push(
            Dataset({
                name: name,
                description: description,
                price: price,
                active: true
            })
        );

        emit DatasetRegistered(id, name, price);
    }

    function recordPurchase(
        address buyer,
        uint256 datasetId,
        uint256 pricePaid,
        bytes32 queryHash
    ) external onlyRecorderOrOwner {
        require(buyer != address(0), "DataMarketplace: zero buyer");
        require(datasetId < datasets.length, "DataMarketplace: invalid dataset");
        require(datasets[datasetId].active, "DataMarketplace: inactive dataset");
        require(pricePaid > 0, "DataMarketplace: zero price");

        uint256 purchaseId = purchases.length;

        purchases.push(
            Purchase({
                buyer: buyer,
                datasetId: datasetId,
                pricePaid: pricePaid,
                queryHash: queryHash,
                timestamp: block.timestamp
            })
        );

        purchasesByBuyer[buyer].push(purchaseId);

        emit PurchaseRecorded(purchaseId, buyer, datasetId);
    }

    function getPurchasesByBuyer(
        address buyer
    ) external view returns (uint256[] memory) {
        return purchasesByBuyer[buyer];
    }

    function getPurchase(uint256 id) external view returns (Purchase memory) {
        require(id < purchases.length, "DataMarketplace: invalid purchase");
        return purchases[id];
    }

    function getDataset(uint256 id) external view returns (Dataset memory) {
        require(id < datasets.length, "DataMarketplace: invalid dataset");
        return datasets[id];
    }

    function getDatasetCount() external view returns (uint256) {
        return datasets.length;
    }

    function getTotalPurchases() external view returns (uint256) {
        return purchases.length;
    }
}