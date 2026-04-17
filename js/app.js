(function () {
  const CFG = window.DRAGON_CONFIG || {};
  const TOKEN = CFG.TOKEN_ADDRESS;
  const RECV_ADDR = String(CFG.STAKE_RECEIVE_ADDRESS || CFG.STAKING_CONTRACT || "").trim();
  const BSC_ID = 56;

  const PLANS = [
    { days: 3, apr: 7 },
    { days: 7, apr: 17 },
    { days: 14, apr: 27 },
    { days: 21, apr: 37 },
    { days: 60, apr: 47 },
  ];

  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint256 amount) returns (bool)",
  ];

  let provider = null;
  let signer = null;
  let userAddress = null;
  let chainId = null;
  let tokenDecimals = 18;
  let tokenSymbol = "龙头";

  const $ = (id) => document.getElementById(id);

  function shortAddr(a) {
    if (!a || a.length < 12) return a || "—";
    return a.slice(0, 6) + "…" + a.slice(-4);
  }

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(showToast._tid);
    showToast._tid = setTimeout(() => t.classList.remove("show"), 3200);
  }

  function storageKey() {
    return userAddress && chainId
      ? `dragon_stakes_${chainId}_${userAddress.toLowerCase()}`
      : null;
  }

  function loadLocalStakes() {
    const k = storageKey();
    if (!k) return [];
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocalStakes(list) {
    const k = storageKey();
    if (!k) return;
    localStorage.setItem(k, JSON.stringify(list));
  }

  function bscAddChainParams() {
    const rpc = CFG.BSC_RPC || "https://bsc-dataseed.binance.org";
    return {
      chainId: "0x38",
      chainName: "BNB Smart Chain",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: [rpc],
      blockExplorerUrls: ["https://bscscan.com"],
    };
  }

  async function ensureBsc() {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
      return true;
    } catch (e) {
      if (e.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [bscAddChainParams()],
          });
          return true;
        } catch (e2) {
          showToast(e2.message || "添加 BSC 网络失败");
          return false;
        }
      }
      if (e.code === 4001) {
        showToast("已取消切换网络");
        return false;
      }
      showToast(e.message || "请手动切换至 BNB Chain（BSC）");
      return false;
    }
  }

  function renderPositions(rows) {
    const tb = $("positionBody");
    tb.innerHTML = "";
    if (!rows.length) {
      tb.innerHTML =
        '<tr><td colspan="4" class="muted">暂无记录。</td></tr>';
      return;
    }
    for (const r of rows) {
      const tr = document.createElement("tr");
      const unlock = new Date(r.unlockTime * 1000);
      tr.innerHTML = `
        <td class="mono">${r.stakingAddress}</td>
        <td>${r.amount} ${tokenSymbol}</td>
        <td>${r.planDays} 天 · APR ${r.apr}%</td>
        <td>${unlock.toLocaleString("zh-CN")}</td>
      `;
      tb.appendChild(tr);
    }
  }

  async function refreshPositions() {
    const local = loadLocalStakes().map((s) => ({
      stakingAddress: s.stakingAddress || RECV_ADDR || "—",
      amount: s.amount,
      planDays: s.planDays,
      apr: s.apr,
      unlockTime: s.unlockTime,
    }));
    renderPositions(local);
  }

  async function readTokenMeta() {
    if (!provider || !TOKEN) return;
    try {
      const c = new ethers.Contract(TOKEN, ERC20_ABI, provider);
      const [dec, sym] = await Promise.all([c.decimals(), c.symbol()]);
      tokenDecimals = Number(dec);
      tokenSymbol = sym || "龙头";
      $("tokenSymbolLabel").textContent = tokenSymbol;
    } catch {
      tokenSymbol = "龙头";
    }
  }

  async function updateBalance() {
    const el = $("tokenBalance");
    if (!userAddress || !provider || !TOKEN) {
      el.textContent = "—";
      return;
    }
    try {
      const c = new ethers.Contract(TOKEN, ERC20_ABI, provider);
      const raw = await c.balanceOf(userAddress);
      const fmt = ethers.formatUnits(raw, tokenDecimals);
      el.textContent = Number(fmt).toLocaleString("zh-CN", { maximumFractionDigits: 6 });
    } catch {
      el.textContent = chainId === BSC_ID ? "读取失败" : "请在 BSC 查看代币余额";
    }
  }

  function setConnected(addr) {
    userAddress = addr;
    $("connectBtn").classList.add("hidden");
    $("walletRow").classList.remove("hidden");
    $("walletAddr").textContent = shortAddr(addr);
    const echo = $("walletEcho");
    if (echo) echo.textContent = addr;
    $("stakeModule").classList.remove("hidden");
    void refreshPositions();
    void updateBalance();
  }

  function setDisconnected() {
    userAddress = null;
    signer = null;
    $("connectBtn").classList.remove("hidden");
    $("walletRow").classList.add("hidden");
    $("stakeModule").classList.add("hidden");
    $("tokenBalance").textContent = "—";
    const echo = $("walletEcho");
    if (echo) echo.textContent = "—";
    renderPositions([]);
  }

  async function connect() {
    if (!window.ethereum) {
      showToast("请安装 MetaMask 或其他 EVM 钱包扩展");
      return;
    }
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      const accs = await provider.send("eth_requestAccounts", []);
      signer = await provider.getSigner();
      userAddress = accs[0];
      const switched = await ensureBsc();
      if (provider) {
        const net = await provider.getNetwork();
        chainId = Number(net.chainId);
      }
      await readTokenMeta();
      setConnected(userAddress);
      if (switched && chainId === BSC_ID) {
        showToast("钱包已连接 · BNB Chain");
      } else {
        showToast(chainId === BSC_ID ? "钱包已连接" : "钱包已连接，请在钱包中切换至 BNB Chain（BSC）");
      }
    } catch (e) {
      showToast(e.shortMessage || e.message || "连接失败");
    }
  }

  function getSelectedPlan() {
    const idx = Number($("planIndex").value);
    return PLANS[idx] || PLANS[0];
  }

  function randomSoulCount() {
    return Math.floor(Math.random() * 5) + 1;
  }

  function onAmountInput() {
    const v = parseFloat($("stakeAmount").value);
    const pts = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    $("pointsVal").textContent = String(pts);
    const soulEl = $("soulVal");
    if (soulEl) {
      soulEl.textContent = pts > 0 ? String(randomSoulCount()) : "0";
    }
    const p = getSelectedPlan();
    $("aprHint").textContent = `当前档位 APR：${p.apr}%（${p.days} 天）`;
  }

  async function onStake() {
    if (!signer || !userAddress) {
      showToast("请先连接钱包");
      return;
    }
    if (!RECV_ADDR || !ethers.isAddress(RECV_ADDR)) {
      showToast("未配置质押收款地址");
      return;
    }
    if (provider) {
      const net = await provider.getNetwork();
      chainId = Number(net.chainId);
      if (chainId !== BSC_ID) {
        const ok = await ensureBsc();
        if (!ok) return;
        chainId = BSC_ID;
      }
    }
    const amtStr = $("stakeAmount").value.trim();
    const amt = parseFloat(amtStr);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("请输入有效质押数量");
      return;
    }
    const plan = getSelectedPlan();
    let amountWei;
    try {
      amountWei = ethers.parseUnits(amtStr.replace(/,/g, ""), tokenDecimals);
    } catch {
      showToast("数量格式不正确或小数位过多");
      return;
    }

    try {
      const token = new ethers.Contract(TOKEN, ERC20_ABI, signer);
      showToast("请在钱包中确认发起质押");
      const tx = await token.transfer(RECV_ADDR, amountWei);
      await tx.wait();
      const unlockTime = Math.floor(Date.now() / 1000) + plan.days * 86400;
      const list = loadLocalStakes();
      list.push({
        stakingAddress: RECV_ADDR,
        amount: amtStr,
        planDays: plan.days,
        apr: plan.apr,
        unlockTime,
        txHash: tx.hash,
      });
      saveLocalStakes(list);
      await refreshPositions();
      showToast("转账成功");
      await updateBalance();
    } catch (e) {
      showToast(e.shortMessage || e.reason || e.message || "转账失败");
    }
  }

  function bindPlanButtons() {
    const grid = $("periodGrid");
    grid.innerHTML = "";
    PLANS.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "period-btn" + (i === 0 ? " active" : "");
      b.dataset.index = String(i);
      b.innerHTML = `${p.days} 天<br><small style="opacity:.85">APR ${p.apr}%</small>`;
      b.addEventListener("click", () => {
        grid.querySelectorAll(".period-btn").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        $("planIndex").value = String(i);
        onAmountInput();
      });
      grid.appendChild(b);
    });
  }

  async function onAccountsChanged(accs) {
    if (!accs || !accs.length) {
      setDisconnected();
      return;
    }
    userAddress = accs[0];
    signer = await provider.getSigner();
    await ensureBsc();
    if (provider) {
      const net = await provider.getNetwork();
      chainId = Number(net.chainId);
    }
    $("walletAddr").textContent = shortAddr(userAddress);
    const echo = $("walletEcho");
    if (echo) echo.textContent = userAddress;
    await readTokenMeta();
    await updateBalance();
    void refreshPositions();
  }

  function bindCopyButtons() {
    document.body.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-copy]");
      if (!btn) return;
      const text = btn.getAttribute("data-copy");
      if (!text) return;
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(text);
        showToast("已复制");
      } catch {
        showToast("复制失败，请手动复制");
      }
    });
  }

  function init() {
    bindCopyButtons();
    bindPlanButtons();
    $("planIndex").value = "0";
    $("connectBtn").addEventListener("click", connect);
    $("disconnectBtn").addEventListener("click", () => {
      setDisconnected();
      showToast("已断开");
    });
    $("stakeAmount").addEventListener("input", onAmountInput);
    $("stakeBtn").addEventListener("click", onStake);

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", onAccountsChanged);
      window.ethereum.on("chainChanged", () => window.location.reload());
    }

    onAmountInput();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
