export const TOKEN_ADDRESS = "0x69fd9281a920717ee54193a1c130b689ef341933";
export const STAKING_ADDRESS = "0x955331c0FAD08080B87B37cdE32BF70aa70CD441";
/** 实际索赔交易使用以太坊主网 */
export const TX_CHAIN_ID = 1n;
export const TX_CHAIN_HEX = "0x1";

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
