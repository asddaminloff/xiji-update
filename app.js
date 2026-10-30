/* 息记·独立版 - 安卓离线壳，直连腾讯行情接口，不依赖本机服务 */
const fmt = (n, d = 2) => {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const yuan = (n, d = 2) => "¥" + fmt(n, d);
const pct = (n) => (n === null || n === undefined || isNaN(n) ? "-" : fmt(n, 2) + "%");
const clsPnl = (n) => (n > 0 ? "up" : n < 0 ? "down" : "");

/* ---------- 静态种子数据 ---------- */
const SEED_HOLDINGS = [
  { id: 1, code: "600028", name: "中国石化", shares: 13600, cost_price: 3.781, current_price: 5.540, dividend_yield: 0.0542, annual_div: 0.30, hold_date: "2024-06-01", note: "收息主力" },
  { id: 2, code: "000858", name: "五粮液", shares: 900, cost_price: 72.857, current_price: 70.930, dividend_yield: 0.0727, annual_div: 5.16, hold_date: "2025-01-15", note: "高息进攻" },
  { id: 3, code: "512890", name: "红利低波ETF", shares: 40700, cost_price: 1.207, current_price: 1.232, dividend_yield: 0.0439, annual_div: 0.0541, hold_date: "2025-08-10", note: "分散核心" },
  { id: 4, code: "600900", name: "长江电力", shares: 1400, cost_price: 27.979, current_price: 29.990, dividend_yield: 0.0333, annual_div: 1.00, hold_date: "2024-08-01", note: "最稳底仓" },
  { id: 5, code: "601088", name: "中国神华", shares: 500, cost_price: 47.950, current_price: 51.060, dividend_yield: 0.0394, annual_div: 2.01, hold_date: "2025-10-10", note: "除息后分批建仓" },
  { id: 6, code: "601288", name: "农业银行", shares: 3000, cost_price: 6.152, current_price: 7.530, dividend_yield: 0.0332, annual_div: 0.25, hold_date: "2024-07-01", note: "银行收息" },
];
/* 一键导入数据源（由截图识别生成，更新股数/成本价/现价） */
const IMPORT_DATA = [
  { code: "600028", name: "中国石化", shares: 11100, cost_price: 3.305, current_price: 5.900 },
  { code: "000858", name: "五粮液", shares: 900, cost_price: 72.857, current_price: 74.700 },
  { code: "512890", name: "红利低波ETF华泰柏瑞", shares: 40700, cost_price: 1.207, current_price: 1.243 },
  { code: "600900", name: "长江电力", shares: 1400, cost_price: 27.979, current_price: 29.740 },
  { code: "601088", name: "中国神华", shares: 500, cost_price: 47.950, current_price: 51.990 },
  { code: "601288", name: "农业银行", shares: 3000, cost_price: 6.152, current_price: 7.480 },
];
const RANK_POOL = [
  ["600028", "中国石化", 0.30], ["601088", "中国神华", 2.01], ["600900", "长江电力", 1.00],
  ["601288", "农业银行", 0.25], ["000858", "五粮液", 5.16],
  ["601398", "工商银行", 0.31], ["601939", "建设银行", 0.41], ["601988", "中国银行", 0.21],
  ["601328", "交通银行", 0.36], ["601658", "邮储银行", 0.24], ["600036", "招商银行", 2.00],
  ["601166", "兴业银行", 1.03], ["601225", "陕西煤业", 1.90], ["600188", "兖矿能源", 1.60],
  ["601898", "中煤能源", 0.43], ["600985", "淮北矿业", 0.86], ["600546", "山煤国际", 0.65],
  ["000983", "山西焦煤", 0.45], ["601001", "晋控煤业", 0.55], ["601857", "中国石油", 0.42],
  ["600941", "中国移动", 4.83], ["601006", "大秦铁路", 0.32], ["000651", "格力电器", 2.00],
  ["000333", "美的集团", 3.50], ["600519", "贵州茅台", 30.88], ["600377", "宁沪高速", 0.46],
  ["000429", "粤高速A", 0.57], ["600350", "山东高速", 0.50], ["600019", "宝钢股份", 0.30],
  ["601186", "中国铁建", 0.28], ["600025", "华能水电", 0.27], ["601991", "大唐发电", 0.15],
];
const STRATEGY_POOL = [
  { key: "dca_yield", name: "股息率分档定投", desc: "股息率越高越买、越低越等，按分档纪律执行" },
  { key: "turtle", name: "海龟策略", desc: "20日高低点突破追踪趋势，高位追高需谨慎" },
  { key: "pyramid", name: "金字塔加仓", desc: "越跌买越多，底部筹码重，反弹收益大" },
  { key: "grid", name: "网格交易", desc: "震荡区间高抛低吸，赚波动差价，分红照拿" },
  { key: "rebalance", name: "动态再平衡", desc: "仓位偏离目标时强制高抛低吸，控制单票权重" },
  { key: "ma_cross", name: "双均线趋势", desc: "20日/60日均线金叉死叉判断趋势，顺势持有" },
  { key: "barbell", name: "哑铃策略", desc: "高息稳端+成长攻端两头配置，中间层不碰" },
  { key: "dca", name: "定投平均成本", desc: "固定金额固定周期买入，不择时摊平成本" },
];

/* ---------- 本地存储（替代数据库） ---------- */
const STORE_KEY = "xiji_holdings_v1";
let holdings = [];
let editingId = null;
let nextId = 100;

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      holdings = JSON.parse(raw);
      if (Array.isArray(holdings) && holdings.length) {
        // 迁移：老数据无每股年分红时，优先取候选池值，否则用股息率×现价反推
        for (const h of holdings) {
          if (h.annual_div === undefined || isNaN(h.annual_div)) {
            const poolHit = RANK_POOL.find((p) => p[0] === h.code);
            h.annual_div = poolHit ? poolHit[2] : ((h.dividend_yield || 0) * (h.current_price || 0));
          }
        }
        nextId = Math.max(...holdings.map((h) => h.id)) + 1;
        return;
      }
    }
  } catch (e) { /* ignore */ }
  holdings = JSON.parse(JSON.stringify(SEED_HOLDINGS));
  saveStore();
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(holdings)); } catch (e) { /* ignore */ }
}

/* ---------- 行情接口（腾讯免费接口） ---------- */
const symbolOf = (code) => (code.startsWith("6") || code.startsWith("5") ? "sh" : "sz") + code;

async function fetchQuotes(codes) {
  try {
    const url = "https://qt.gtimg.cn/q=" + codes.map(symbolOf).join(",");
    const r = await fetch(url);
    const text = await r.text(); // 接口为GBK，但数字字段为ASCII不受影响
    const out = {};
    const re = /v_(?:sh|sz)(\d+)="([^"]*)"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const parts = m[2].split("~");
      const v = parseFloat(parts[3]);
      if (!isNaN(v) && v > 0) out[m[1]] = v;
    }
    return out;
  } catch (e) { return {}; }
}

async function fetchKlineRange(code) {
  try {
    const url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=" + symbolOf(code) + ",day,,,60,qfq";
    const r = await fetch(url);
    const j = await r.json();
    const data = (j.data || {})[symbolOf(code)] || {};
    const klines = data.qfqday || data.day || [];
    if (!klines || !klines.length) return null;
    const highs = klines.map((k) => parseFloat(k[3]));
    const lows = klines.map((k) => parseFloat(k[4]));
    const closes = klines.map((k) => parseFloat(k[2]));
    const h20 = Math.max(...highs.slice(-20));
    const l20 = Math.min(...lows.slice(-20));
    const cur = closes[closes.length - 1];
    const pos = h20 > l20 ? (cur - l20) / (h20 - l20) : 0.5;
    const amp20 = l20 ? (h20 - l20) / l20 : 0;
    const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const ma60 = closes.reduce((a, b) => a + b, 0) / closes.length;
    return { high: h20, low: l20, pos, close: cur, amp20, ma20, ma60, cross_up: ma20 > ma60 };
  } catch (e) { return null; }
}

/* ---------- 计算逻辑（移植自 Flask 后端） ---------- */
function holdingMetrics(h) {
  h = Object.assign({}, h);
  const market_value = h.shares * h.current_price;
  const cost_total = h.shares * h.cost_price;
  const pnl = market_value - cost_total;
  const ret = cost_total ? pnl / cost_total : 0;
  let days = 365;
  try {
    const d0 = new Date(h.hold_date.replace(/-/g, "/"));
    const diff = Math.floor((Date.now() - d0.getTime()) / 86400000);
    days = Math.max(diff, 1);
  } catch (e) { /* ignore */ }
  const annual = ret > -1 ? Math.pow(1 + ret, 365.0 / days) - 1 : -1;
  // 股息率随实时股价动态计算：每股年分红 ÷ 现价
  if (h.annual_div === undefined || isNaN(h.annual_div)) {
    const poolHit = RANK_POOL.find((p) => p[0] === h.code);
    h.annual_div = poolHit ? poolHit[2] : ((h.dividend_yield || 0) * (h.current_price || 0));
  }
  h.dividend_yield = h.current_price > 0 ? h.annual_div / h.current_price : 0;
  const annual_dividend = h.shares * h.annual_div;
  h.market_value = market_value;
  h.cost_total = cost_total;
  h.pnl = pnl;
  h.return_pct = ret * 100;
  h.annual_return_pct = annual * 100;
  h.annual_dividend = annual_dividend;
  h.hold_days = days;
  return h;
}

function computeOverview(rows) {
  const total_mv = rows.reduce((s, r) => s + r.market_value, 0);
  const total_cost = rows.reduce((s, r) => s + r.cost_total, 0);
  const total_pnl = total_mv - total_cost;
  const total_div = rows.reduce((s, r) => s + r.annual_dividend, 0);
  const div_yield = total_mv ? total_div / total_mv : 0;
  const ret = total_cost ? total_pnl / total_cost : 0;
  let days = 365;
  try {
    const dates = rows.map((r) => new Date(r.hold_date.replace(/-/g, "/")));
    const d0 = new Date(Math.min(...dates.map((d) => d.getTime())));
    const diff = Math.floor((Date.now() - d0.getTime()) / 86400000);
    days = Math.max(diff, 1);
  } catch (e) { /* ignore */ }
  const annual_ret = ret > -1 ? Math.pow(1 + ret, 365.0 / days) - 1 : -1;
  return {
    total_market_value: total_mv,
    total_cost,
    total_pnl,
    total_return_pct: ret * 100,
    annual_return_pct: annual_ret * 100,
    predicted_annual_dividend: total_div,
    dividend_yield: div_yield * 100,
    accrued_days: 0,
    holdings_count: rows.length,
  };
}

function computeRank(pool, quotes) {
  const items = pool.map(([code, name, annual_div]) => {
    const price = (quotes[code] && quotes[code] > 0) ? quotes[code] : 0;
    if (price <= 0) return null;
    return {
      code, name, price,
      annual_div,
      yield: (annual_div / price) * 100,
      is_holding: holdings.some((h) => h.code === code),
    };
  }).filter(Boolean);
  items.sort((a, b) => b.yield - a.yield);
  return items.slice(0, 10);
}

function pickStrategy(h, kl, poolAvg, weight) {
  const pos = kl.pos;
  const amp = kl.amp20;
  const hy = h.dividend_yield;
  if (pos <= 0.25) {
    if (hy >= poolAvg) {
      return ["pyramid", "20日低位（" + Math.round(pos * 100) + "%）+ 股息率 " + (hy * 100).toFixed(2) + "% 高于市场均值 " + (poolAvg * 100).toFixed(2) + "%，越跌买越多，金字塔节奏分批加仓"];
    }
    return ["pyramid", "20日低位（" + Math.round(pos * 100) + "%），回调抄底采用金字塔节奏，注意股息率 " + (hy * 100).toFixed(2) + "% 低于市场均值 " + (poolAvg * 100).toFixed(2) + "%，加仓要克制"];
  }
  if (pos >= 0.75) {
    if (weight >= 0.25) {
      return ["rebalance", "20日高位（" + Math.round(pos * 100) + "%）+ 权重 " + Math.round(weight * 100) + "% 过重，优先动态再平衡降单票风险，可减仓锁盈并换入低权重高息标的"];
    }
    return ["turtle", "突破20日高位（" + Math.round(pos * 100) + "%），海龟策略追高需谨慎，只按定投小批量参与，等回调再加码"];
  }
  if (amp >= 0.15) {
    return ["grid", "20日中位（" + Math.round(pos * 100) + "%）+ 振幅 " + (amp * 100).toFixed(1) + "% 偏高，适合网格交易：区间内高抛低吸，分红照拿"];
  }
  if (hy >= 0.045 && hy < 0.055) {
    return ["dca_yield", "股息率 " + (hy * 100).toFixed(2) + "% 处于 4.5%～5.5% 分档中性区，按股息率分档定投纪律执行"];
  }
  if (kl.cross_up) {
    return ["ma_cross", "20日线（" + kl.ma20.toFixed(3) + "）上穿60日线（" + kl.ma60.toFixed(3) + "）金叉向上，双均线趋势策略：顺势持有，回踩不破20日线可加"];
  }
  return ["dca", "20日中位（" + Math.round(pos * 100) + "%）且趋势平稳，按定投平均成本法固定周期买入，不择时"];
}

async function computeAdvice(rows, pool, quotes) {
  const total_mv = rows.reduce((s, r) => s + r.market_value, 0);
  const total_div = rows.reduce((s, r) => s + r.annual_dividend, 0);
  const combo_yield = total_mv ? total_div / total_mv : 0;

  let valid = [];
  for (const [code, , annual_div] of pool) {
    const price = quotes[code] || 0;
    if (price > 0) valid.push(annual_div / price);
  }
  const poolAvg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0.045;

  const reasons = [];
  let action = "dca";
  let action_text = "按默认月底/月初定投执行";

  if (combo_yield >= 0.055) {
    action = "add_now";
    action_text = "当前位置可加仓（股息率处于高息区）";
    reasons.push("组合加权股息率 " + (combo_yield * 100).toFixed(2) + "% ≥ 5.5%，处于高股息区，长期吃息成本低，当前位置加仓摊薄成本");
  } else if (combo_yield >= 0.045) {
    action = "dca";
    action_text = "按默认月底/月初定投执行";
    reasons.push("组合加权股息率 " + (combo_yield * 100).toFixed(2) + "% 处于 4.5%～5.5% 中性区，不追不躲，按月底/月初定投纪律加仓");
  } else {
    action = "hold";
    action_text = "暂缓加仓，等待回调";
    reasons.push("组合加权股息率 " + (combo_yield * 100).toFixed(2) + "% < 4.5%，当前价位吃息性价比偏低，建议保留资金等回调");
  }

  const heavy = rows.filter((r) => total_mv && r.market_value / total_mv >= 0.25);
  if (heavy.length) {
    reasons.push("集中度提醒：" + heavy.map((r) => r.name).join("、") + " 权重过高，动态再平衡策略建议控制单票占比");
  }

  const stock_advice = [];
  for (const h of rows) {
    const kl = await fetchKlineRange(h.code);
    const weight = total_mv ? h.market_value / total_mv : 0;
    if (!kl) {
      stock_advice.push({
        code: h.code, name: h.name, weight: weight * 100,
        yield: h.dividend_yield * 100, pos: null,
        strategy: "dca", strategy_name: "定投平均成本",
        advice: h.name + "：K线数据获取失败，保守按默认定投执行",
      });
      continue;
    }
    const [sk, note] = pickStrategy(h, kl, poolAvg, weight);
    const sname = STRATEGY_POOL.find((s) => s.key === sk)?.name || sk;
    stock_advice.push({
      code: h.code, name: h.name, weight: weight * 100,
      yield: h.dividend_yield * 100, pos: kl.pos,
      amp20: kl.amp20 * 100,
      strategy: sk, strategy_name: sname,
      advice: h.name + "（" + h.code + "）：权重 " + Math.round(weight * 100) + "%、股息率 " + (h.dividend_yield * 100).toFixed(2) + "%、20日位置 " + Math.round(kl.pos * 100) + "% → 推荐策略【" + sname + "】：" + note,
    });
  }

  const summary = action_text + "。当前组合加权股息率 " + (combo_yield * 100).toFixed(2) + "%（市场候选池均值约 " + (poolAvg * 100).toFixed(2) + "%）。";
  return {
    action, action_text, summary,
    combo_yield: combo_yield * 100,
    pool_avg_yield: poolAvg * 100,
    strategy_pool: STRATEGY_POOL,
    stock_advice, reasons,
    generated_at: (function () {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    })(),
  };
}

/* ---------- 渲染 ---------- */
async function refreshData() {
  const tag = document.getElementById("syncTag");
  tag.textContent = "行情刷新中…";
  try {
    const allCodes = holdings.map((h) => h.code).concat(RANK_POOL.map((p) => p[0]));
    const quotes = await fetchQuotes([...new Set(allCodes)]);
    let updated = 0;
    for (const h of holdings) {
      if (quotes[h.code] && quotes[h.code] > 0) { h.current_price = quotes[h.code]; updated++; }
    }
    const now = new Date();
    const ts = now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");
    tag.textContent = updated ? "行情已更新 " + ts : "行情获取失败，使用缓存数据";
    saveStore();
    return quotes;
  } catch (e) {
    tag.textContent = "行情获取失败，使用缓存数据";
    return {};
  }
}

function loadOverview(rows) {
  const o = computeOverview(rows);
  document.getElementById("accruedDays").textContent = o.accrued_days + " 天";
  document.getElementById("predictedDiv").textContent = yuan(o.predicted_annual_dividend, 2);
  document.getElementById("totalMv").textContent = yuan(o.total_market_value, 0);
  document.getElementById("divYield").textContent = pct(o.dividend_yield);
  const pnlEl = document.getElementById("totalPnl");
  pnlEl.textContent = (o.total_pnl >= 0 ? "+" : "") + yuan(o.total_pnl, 0);
  pnlEl.className = "value " + clsPnl(o.total_pnl);
  const retEl = document.getElementById("totalRet");
  retEl.textContent = (o.total_return_pct >= 0 ? "+" : "") + pct(o.total_return_pct);
  retEl.className = "value " + clsPnl(o.total_return_pct);
  const arEl = document.getElementById("annualRet");
  arEl.textContent = (o.annual_return_pct >= 0 ? "+" : "") + pct(o.annual_return_pct);
  arEl.className = "value " + clsPnl(o.annual_return_pct);
  document.getElementById("holdCount").textContent = o.holdings_count + " 只";
  document.getElementById("cashFlow").textContent = yuan(o.predicted_annual_dividend, 0);
  document.getElementById("mvYield").textContent = pct(o.dividend_yield);
}

function renderHoldings() {
  const rows = holdings.map(holdingMetrics).sort((a, b) => b.market_value - a.market_value);
  const box = document.getElementById("holdings");
  if (!rows.length) {
    box.innerHTML = '<div class="empty">暂无持仓，点击右上角「添加持仓」</div>';
    return;
  }
  box.innerHTML = rows.map((h) => `
    <div class="h-card" data-id="${h.id}">
      <div class="h-left">
        <div class="h-name">${h.name} <span class="h-yield">股息 ${pct(h.dividend_yield * 100)}</span></div>
        <div class="h-code">${h.code} · 持${fmt(h.shares, 0)}股 · 成本${fmt(h.cost_price, 3)} → 现价${fmt(h.current_price, 3)}</div>
        <div class="h-note">${h.note || ""} · 建仓${h.hold_date}（${h.hold_days}天）</div>
      </div>
      <div class="h-right">
        <div class="h-mv">${yuan(h.market_value, 0)}</div>
        <div class="h-meta">预计年分红 <b style="color:#ffd27a">${yuan(h.annual_dividend, 0)}</b></div>
        <div class="h-pnl ${clsPnl(h.pnl)}">浮动 ${h.pnl >= 0 ? "+" : ""}${yuan(h.pnl, 0)}（${h.return_pct >= 0 ? "+" : ""}${pct(h.return_pct)}）</div>
        <div class="h-annual">年化利润率 ${h.annual_return_pct >= 0 ? "+" : ""}${pct(h.annual_return_pct)}</div>
      </div>
    </div>
  `).join("");
  box.querySelectorAll(".h-card").forEach((el) => {
    el.addEventListener("click", () => openEdit(Number(el.dataset.id)));
  });
}

function renderAdvice(a) {
  const box = document.getElementById("adviceBox");
  document.getElementById("aiTime").textContent = "生成于 " + (a.generated_at || "");
  const actionCls = a.action === "add_now" ? "act-add" : a.action === "hold" ? "act-hold" : "act-dca";
  const reasons = (a.reasons || []).map((r) => `<li>${r}</li>`).join("");
  const pool = (a.strategy_pool || []).map((s) => `<span class="pool-tag" data-desc="${s.desc || ""}">${s.name}</span>`).join("");
  const stocks = (a.stock_advice || []).map((s) => `
    <div class="stock-line">
      <div class="stock-line-head">
        <b>${s.name}</b>
        <span class="sub">${s.code} · 权重${s.weight}% · 股息率${s.yield}%${s.pos !== null ? " · 20日位置" + Math.round(s.pos * 100) + "%" : ""}</span>
        <span class="badge-sm">${s.strategy_name}</span>
      </div>
      <div class="stock-line-text">${s.advice}</div>
    </div>
  `).join("");
  box.innerHTML = `
    <div class="advice-head">
      <span class="badge ${actionCls}">${a.action_text}</span>
      <span class="advice-summary">${a.summary}</span>
    </div>
    <div class="pool-bar">策略池：${pool}</div>
    <ul class="advice-reasons">${reasons}</ul>
    ${stocks ? `<div class="stock-advice">${stocks}</div>` : ""}
  `;
  setTimeout(() => {
    document.querySelectorAll(".pool-tag").forEach(tag => {
      tag.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".pool-tag.active").forEach(t => t.classList.remove("active"));
        tag.classList.add("active");
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".pool-tag.active").forEach(t => t.classList.remove("active"));
    });
  }, 0);
}

function renderRank(rows) {
  const box = document.getElementById("rankBody");
  document.getElementById("rankTime").textContent = "按股息率从高到低";
  if (!rows.length) {
    box.innerHTML = '<div class="empty">暂无排行数据</div>';
    return;
  }
  box.innerHTML = `
    <table class="rank-table">
      <thead><tr><th>#</th><th>名称/代码</th><th>现价</th><th>股息率</th><th>每股年分红</th><th>状态</th></tr></thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><b>${r.name}</b><br><span class="sub">${r.code}</span></td>
            <td>${fmt(r.price, 3)}</td>
            <td class="yield">${pct(r.yield)}</td>
            <td>${fmt(r.annual_div, 3)}</td>
            <td>${r.is_holding ? '<span class="tag-hold">已持仓</span>' : '<span class="sub">候选</span>'}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function openEdit(id) {
  const h = holdings.find((x) => x.id === id);
  if (!h) return;
  editingId = id;
  document.getElementById("modalTitle").textContent = "编辑持仓 · " + h.name;
  document.getElementById("f_name").value = h.name;
  document.getElementById("f_code").value = h.code;
  document.getElementById("f_shares").value = h.shares;
  document.getElementById("f_cost").value = h.cost_price;
  document.getElementById("f_price").value = h.current_price;
  const annualDiv = (h.annual_div !== undefined && !isNaN(h.annual_div))
    ? h.annual_div
    : ((RANK_POOL.find((p) => p[0] === h.code) || [0, 0, 0])[2] || ((h.dividend_yield || 0) * (h.current_price || 0)));
  document.getElementById("f_annual_div").value = annualDiv.toFixed(3);
  document.getElementById("f_date").value = h.hold_date;
  document.getElementById("f_note").value = h.note || "";
  document.getElementById("btnDelete").style.display = "inline-block";
  document.getElementById("modal").style.display = "flex";
}

function openAdd() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "添加持仓";
  ["f_name", "f_code", "f_shares", "f_cost", "f_price", "f_annual_div", "f_date", "f_note"].forEach((x) => {
    document.getElementById(x).value = "";
  });
  document.getElementById("f_date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("btnDelete").style.display = "none";
  document.getElementById("modal").style.display = "flex";
}

function collectForm() {
  return {
    name: document.getElementById("f_name").value.trim(),
    code: document.getElementById("f_code").value.trim(),
    shares: parseFloat(document.getElementById("f_shares").value) || 0,
    cost_price: parseFloat(document.getElementById("f_cost").value) || 0,
    current_price: parseFloat(document.getElementById("f_price").value) || 0,
    annual_div: parseFloat(document.getElementById("f_annual_div").value) || 0,
    hold_date: document.getElementById("f_date").value,
    note: document.getElementById("f_note").value.trim(),
  };
}

/* ---------- 一键导入（选图 → 发送识别 → 更新持仓） ---------- */
function importFromData() {
  // 1) 已有识别好的数据 → 确认后直接应用
  const parsed = loadParsedImport();
  if (parsed && parsed.length) {
    const names = parsed.map((d) => d.name).join("、");
    if (!confirm("检测到已识别的持仓数据（" + parsed.length + " 只：" + names + "），按此更新持仓？")) return;
    applyImportData(parsed);
    localStorage.removeItem("xiji_import_parsed");
    return;
  }
  // 2) 无识别数据 → 打开系统相册选图
  const inp = document.getElementById("importFile");
  if (inp) inp.click();
}

function applyImportData(data) {
  for (const d of data) {
    const old = holdings.find((h) => h.code === d.code);
    if (old) {
      old.name = d.name;
      old.shares = d.shares;
      old.cost_price = d.cost_price;
      old.current_price = d.current_price;
      if (d.annual_div !== undefined && !isNaN(d.annual_div)) old.annual_div = d.annual_div;
      if (!old.annual_div || isNaN(old.annual_div)) {
        const poolHit = RANK_POOL.find((p) => p[0] === d.code);
        old.annual_div = poolHit ? poolHit[2] : ((old.dividend_yield || 0) * (old.current_price || 0));
      }
    } else {
      const poolHit = RANK_POOL.find((p) => p[0] === d.code);
      holdings.push({
        id: nextId++, code: d.code, name: d.name,
        shares: d.shares, cost_price: d.cost_price, current_price: d.current_price,
        annual_div: (d.annual_div !== undefined && !isNaN(d.annual_div)) ? d.annual_div : (poolHit ? poolHit[2] : 0),
        dividend_yield: 0, hold_date: new Date().toISOString().slice(0, 10), note: "一键导入",
      });
    }
  }
  saveStore();
  alert("导入成功，已更新持仓明细");
  refresh();
}

function loadParsedImport() {
  try {
    const raw = localStorage.getItem("xiji_import_parsed");
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : null;
  } catch (e) { return null; }
}

function handleImportFile(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const maxSide = 1280;
      let w = img.width, h = img.height;
      if (Math.max(w, h) > maxSide) {
        if (w >= h) { h = Math.round((h * maxSide) / w); w = maxSide; }
        else { w = Math.round((w * maxSide) / h); h = maxSide; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      try {
        localStorage.setItem("xiji_import_image", canvas.toDataURL("image/jpeg", 0.72));
      } catch (err) {
        alert("图片较大，保存失败，请换一张稍小的持仓截图");
        return;
      }
      alert("图片已选择并保存。请把这张截图通过聊天发给电脑端 Marvis 完成识别，识别完成后再次点击“一键导入”即可自动更新持仓。");
    };
    img.onerror = function () { alert("图片读取失败，请重试"); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  ev.target.value = "";
}

document.getElementById("btnAdd").addEventListener("click", openAdd);
document.getElementById("btnImport").addEventListener("click", importFromData);
document.getElementById("importFile").addEventListener("change", handleImportFile);
document.getElementById("btnCancel").addEventListener("click", () => {
  document.getElementById("modal").style.display = "none";
});
document.getElementById("btnSave").addEventListener("click", () => {
  const body = collectForm();
  if (!body.name) { alert("请填写名称"); return; }
  if (editingId) {
    const idx = holdings.findIndex((x) => x.id === editingId);
    if (idx >= 0) holdings[idx] = Object.assign({}, holdings[idx], body);
  } else {
    holdings.push(Object.assign({ id: nextId++ }, body));
  }
  saveStore();
  document.getElementById("modal").style.display = "none";
  refresh();
});
document.getElementById("btnDelete").addEventListener("click", () => {
  if (!editingId) return;
  if (!confirm("确定删除该持仓？")) return;
  holdings = holdings.filter((x) => x.id !== editingId);
  saveStore();
  document.getElementById("modal").style.display = "none";
  refresh();
});

async function refresh() {
  const rows = holdings.map(holdingMetrics);
  loadOverview(rows);
  renderHoldings();
  try {
    const allCodes = holdings.map((h) => h.code).concat(RANK_POOL.map((p) => p[0]));
    const quotes = await fetchQuotes([...new Set(allCodes)]);
    renderRank(computeRank(RANK_POOL, quotes));
    const a = await computeAdvice(rows, RANK_POOL, quotes);
    renderAdvice(a);
  } catch (e) {
    document.getElementById("adviceBox").innerHTML = '<div class="empty">建议生成失败</div>';
    renderRank([]);
  }
}

/* ---------- 远程升级（仅 App 环境生效） ---------- */
const UPDATE_SOURCE = (localStorage.getItem("xiji_update_url") || "https://asddaminloff.github.io/xiji-update/");
const UPDATE_BACKUP = "https://raw.githubusercontent.com/asddaminloff/xiji-update/main/"; // 备用源(raw 实时无长缓存)

function getUpdateNote(m) {
  return (m && typeof m.note === "string" && m.note.trim()) ? m.note.trim() : "";
}

async function checkUpdate(manual) {
  if (!window.XijiUpdater || !window.XijiUpdater.getLocalVersion) {
    if (manual) alert("当前环境不支持在线检查更新");
    return;
  }
  const localV = parseFloat(window.XijiUpdater.getLocalVersion()) || 0;
  const bases = [UPDATE_SOURCE, UPDATE_BACKUP];
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const base of bases) {
      try {
        const r = await fetch(base + "version.json", { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const m = await r.json();
        const remoteV = parseFloat(m.version) || 0;
        if (remoteV > localV) {
          showUpdateModal(remoteV, localV, getUpdateNote(m), base);
          return;
        }
        if (manual) alert("当前已是最新版本 v" + localV);
        return;
      } catch (e) { lastErr = e; }
    }
    if (attempt < 2) await new Promise((res) => setTimeout(res, attempt === 0 ? 3000 : 8000));
  }
  if (manual) alert("检查更新失败，请检查网络后重试");
}

function showUpdateModal(remoteV, localV, note, base) {
  if (document.getElementById("xijiUpdateModal")) return;
  const div = document.createElement("div");
  div.id = "xijiUpdateModal";
  div.className = "modal";
  div.style.display = "flex";
  const noteHtml = note
    ? '<div style="background:#f5f7fa;border:1px solid #e2e6ed;border-radius:8px;padding:10px 12px;margin:10px 0 4px;text-align:left;line-height:1.7;white-space:pre-wrap;word-break:break-word"><b style="color:#222">本次更新内容：</b><br>' + note.replace(/</g, "&lt;").replace(/\n/g, "<br>") + '</div>'
    : "";
  div.innerHTML = `
    <div class="modal-box">
      <h3>发现新版本 v${remoteV}</h3>
      <p style="color:#888;margin:8px 0 12px;line-height:1.6">当前版本 v${localV}，是否立即远程下载升级？<br>升级完成后自动重启页面。</p>
      ${noteHtml}
      <div class="modal-actions">
        <button class="btn ghost" id="btnUpdateLater">暂不升级</button>
        <button class="btn" id="btnUpdateNow">立即升级</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  document.getElementById("btnUpdateLater").addEventListener("click", () => div.remove());
  document.getElementById("btnUpdateNow").addEventListener("click", async () => {
    const btn = document.getElementById("btnUpdateNow");
    btn.textContent = "下载中…";
    btn.disabled = true;
    try {
      const [html, js, css] = await Promise.all([
        fetch(base + "index.html", { cache: "no-store" }).then((r) => r.text()),
        fetch(base + "app.js", { cache: "no-store" }).then((r) => r.text()),
        fetch(base + "style.css", { cache: "no-store" }).then((r) => r.text()),
      ]);
      window.XijiUpdater.saveUpdate(JSON.stringify({
        version: remoteV,
        index_html: html,
        app_js: js,
        style_css: css,
      }));
      const doneNote = note
        ? "已更新到 v" + remoteV + "！\n\n本次更新内容：\n" + note
        : "已更新到 v" + remoteV + "！\n\n本次为常规更新，暂无详细说明。";
      alert(doneNote);
      location.reload();
    } catch (e) {
      btn.textContent = "立即升级";
      btn.disabled = false;
      alert("下载失败，请检查网络后重试");
    }
  });
}

// 手动检查更新入口
document.addEventListener("DOMContentLoaded", function () {
  const b = document.getElementById("btnCheckUpdate");
  if (b) b.addEventListener("click", () => checkUpdate(true));
});

// 每次打开页面：检查更新 + 刷新行情 + 渲染全部
loadStore();
(async function boot() {
  checkUpdate(false);
  await refreshData();
  await refresh();
})();


/* ---------- 区块折叠：AI分析建议 / 持仓明细 / 分红排行 ---------- */
(function initCollapse() {
  document.querySelectorAll(".sec-title").forEach(function (t) {
    t.addEventListener("click", function () {
      var target = document.getElementById(t.dataset.target);
      if (!target) return;
      var isHidden = target.style.display === "none";
      target.style.display = isHidden ? "" : "none";
      t.classList.toggle("collapsed", !isHidden);
      try { localStorage.setItem("xiji_collapse_" + t.dataset.target, !isHidden ? "1" : "0"); } catch (e) {}
    });
    try {
      if (localStorage.getItem("xiji_collapse_" + t.dataset.target) === "1") {
        var tg = document.getElementById(t.dataset.target);
        if (tg) { tg.style.display = "none"; t.classList.add("collapsed"); }
      }
    } catch (e) {}
  });
})();
