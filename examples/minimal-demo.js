#!/usr/bin/env node
/**
 * 最小可运行示例（minimal demo）
 * ---------------------------------------------------------------
 * 目的：验证「通过 OKX 官方命令行完成一笔完整交易闭环」这条链路，
 *       以及 AI Builder Code 归因参数是怎么带上的。
 *
 * 本文件**不含任何交易策略**，只演示接口用法：
 *   查行情 → 查余额 → 下一笔远离市价的限价单 → 查询状态 → 撤单
 *   并打印「成交后主程序会自动挂的 OCO 止盈止损命令」（只打印，不执行）
 *
 * 依赖：Node.js >= 18，以及 OKX 官方命令行
 *   npm install -g @okx_ai/okx-trade-cli
 *
 * 用法：
 *   node examples/minimal-demo.js                      # 默认 dry-run，只打印命令，不下单
 *   node examples/minimal-demo.js --read               # 只读：行情 + 余额 + 持仓
 *   node examples/minimal-demo.js --place --demo       # 在模拟盘下一笔最小单并撤掉
 *   node examples/minimal-demo.js --place --demo --aiBuilderCode ABC123
 *
 * 说明：
 *   - --demo 会让 CLI 走模拟盘（虚拟资金），建议先用这个
 *   - 不带 --place 时绝不会下单
 *   - 下单价格取市价的 90%，正常情况下不会成交，撤单后不留痕迹
 */
'use strict';

const { execFileSync } = require('child_process');

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const has = (f) => argv.indexOf(f) >= 0;
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && argv[i + 1][0] !== '-' ? argv[i + 1] : d;
};

const DRY = !has('--place') || has('--dry');
const READ_ONLY = has('--read');
const DEMO = has('--demo');
const YES_LIVE = has('--yes-live');
const INST = val('--instId', 'BTC-USDT-SWAP');
const AMOUNT_USDT = val('--amountUsdt', '20');   // 各币种有最小下单量，BTC 约 7.7U 起

// 硬门禁：真下单必须显式指定环境。走实盘还要再加 --yes-live，避免误触。
if (has('--place') && !DEMO && !YES_LIVE) {
  console.log('拒绝执行：--place 会真实下单。\n' +
    '  · 想在模拟盘试：加 --demo\n' +
    '  · 确认要走实盘：再加 --yes-live\n' +
    '  · 只想看会执行什么命令：去掉 --place（默认 dry-run）');
  process.exit(9);
}

// AI Builder Code：1-16 位字母数字；留空则不传该参数（行为与不带完全一致）
const BC_RAW = String(val('--aiBuilderCode', process.env.OKX_AI_BUILDER_CODE || '')).trim();
const AI_BUILDER_CODE = /^[A-Za-z0-9]{1,16}$/.test(BC_RAW) ? BC_RAW : '';
const BC_ARGS = AI_BUILDER_CODE ? ['--aiBuilderCode', AI_BUILDER_CODE] : [];

// Windows 上 npm 全局装的是 okx.cmd 批处理垫片；Node 18+ 禁止无 shell 直接 spawn .cmd/.bat，
// 所以 Windows 需要走 shell 并对每个参数做引号转义（参数里可能出现 & | > 等 cmd 元字符）。
const IS_WIN = process.platform === 'win32';
const OKX_BIN = process.env.OKX_BIN || (IS_WIN ? 'okx.cmd' : 'okx');

function winQuote(s) {
  const str = String(s);
  return /[^A-Za-z0-9_\-.\/:=]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

// ---------- CLI 封装 ----------
const PROFILE = val('--profile', '');
const GLOBAL_ARGS = ['--json']
  .concat(PROFILE ? ['--profile', PROFILE] : [])
  .concat(DEMO ? ['--demo'] : []);

function runOkx(args, { quiet = false } = {}) {
  const full = GLOBAL_ARGS.concat(args);
  if (!quiet) console.log('    $ ' + OKX_BIN + ' ' + full.join(' '));
  try {
    const argv2 = IS_WIN ? full.map(winQuote) : full;
    const out = execFileSync(OKX_BIN, argv2, {
      encoding: 'utf8',
      timeout: 45000,
      shell: IS_WIN,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const s = out.replace(/^\uFEFF/, '');
    const i = s.indexOf('[') >= 0 && (s.indexOf('[') < s.indexOf('{') || s.indexOf('{') < 0) ? s.indexOf('[') : s.indexOf('{');
    return i >= 0 ? JSON.parse(s.slice(i)) : null;
  } catch (e) {
    // CLI 出错时真实信息常在 stdout 的 JSON 里，stderr 往往只有升级提示
    const pick = (t) => {
      const s = String(t || '');
      const m = s.match(/"(?:sMsg|msg|error)"\s*:\s*"([^"]+)"/);
      if (m) return m[1];
      const line = s.split('\n').map((x) => x.trim())
        .filter((x) => x && !/^Update available|^Run:|^Version:/.test(x))[0];
      return line || '';
    };
    const detail = pick(e.stdout) || pick(e.stderr) || '退出码 ' + e.status;
    console.log('    ! 调用失败: ' + detail);
    return null;
  }
}

const h = (t) => console.log('\n=== ' + t + ' ===');
const ok = (t) => console.log('  ✓ ' + t);
const warn = (t) => console.log('  ! ' + t);

// ---------- 0. 环境 ----------
console.log('OKX 量化系统 · 最小可运行示例');
console.log('  模式      : ' + (READ_ONLY ? '只读' : DRY ? 'dry-run（只打印，不下单）' : '真实下单（下单后会撤销）'));
console.log('  CLI 账户  : ' + (PROFILE || '默认 profile') + '   交易环境: ' + (DEMO ? '模拟盘 demo（虚拟资金）' : '按该 profile 的配置（可能是实盘，请确认！）'));
console.log('  标的      : ' + INST + '  名义金额: ' + AMOUNT_USDT + ' USDT');
console.log('  AI Builder: ' + (AI_BUILDER_CODE ? 'ON (' + AI_BUILDER_CODE + ')' : 'OFF（未提供 code，不传该参数）'));

h('1. 检查 OKX 官方命令行');
try {
  const v = execFileSync(OKX_BIN, ['--version'], {
    encoding: 'utf8', timeout: 15000, shell: IS_WIN, stdio: ['ignore', 'pipe', 'ignore']
  });
  ok('CLI 可用: ' + String(v || '').trim().split('\n')[0]);
} catch (e) {
  warn('未找到 `' + OKX_BIN + '` 命令。请先安装：npm install -g @okx_ai/okx-trade-cli');
  process.exit(1);
}

// ---------- 2. 行情（不需要 API Key） ----------
h('2. 读取行情（公开接口，无需 API Key）');
const tk = runOkx(['market', 'ticker', INST], { quiet: true });
const row = Array.isArray(tk) ? tk[0] : tk;
if (!row || !row.last) {
  warn('行情读取失败（网络或标的代码不对），后续步骤跳过');
  process.exit(2);
}
const last = parseFloat(row.last);
const open24 = parseFloat(row.open24h || row.sodUtc0 || last);
const chg = open24 ? ((last - open24) / open24) * 100 : 0;
ok(INST + ' 最新价 ' + row.last + ' ｜ 24h 涨跌 ' + chg.toFixed(2) + '%');

// ---------- 3. 账户（需要 API Key） ----------
h('3. 读取账户（需要 API Key）');
const bal = runOkx(['account', 'balance'], { quiet: true });
const b0 = Array.isArray(bal) ? bal[0] : bal;
if (!b0 || !b0.totalEq) {
  warn('未读到账户余额 —— 说明本机还没配置 API Key。可用 `okx config init` 配置。');
  console.log('\n（示例到此结束：行情链路已验证，账户链路需要 API Key）');
  process.exit(0);
}
ok('账户总权益 ' + b0.totalEq + ' USD');

const pos = runOkx(['swap', 'positions', INST], { quiet: true });
const posList = (Array.isArray(pos) ? pos : [pos]).filter((p) => p && p.instId);
ok('当前 ' + INST + ' 持仓条数: ' + posList.length);

if (READ_ONLY) {
  console.log('\n（--read 只读模式，结束）');
  process.exit(0);
}

// ---------- 4. 下单 ----------
h('4. 下一笔限价单');
const limitPx = (last * 0.90).toFixed(6);         // 远离市价，正常不会成交
const clOrdId = 'DEMO' + Date.now().toString().slice(-10);  // 字母+数字，<=32 位
const placeArgs = [
  'swap', 'place',
  '--instId', INST,
  '--side', 'buy',
  '--ordType', 'limit',
  '--px', limitPx,
  '--sz', AMOUNT_USDT,
  '--tgtCcy', 'quote_ccy',
  '--tdMode', 'cross',
  '--clOrdId', clOrdId
].concat(BC_ARGS);   // ← Builder Code 就是在下单命令末尾带上这个参数

console.log('  下单命令（注意末尾的归因参数）：');
console.log('    ' + OKX_BIN + ' ' + GLOBAL_ARGS.join(' ') + ' ' + placeArgs.join(' '));

if (DRY) {
  console.log('\n  dry-run：以上命令未执行。确认真实执行请加 --place（建议同时加 --demo）。');
  console.log('  dry-run 结束。');
  process.exit(0);
}

const placed = runOkx(placeArgs, { quiet: true });
const p0 = Array.isArray(placed) ? placed[0] : placed;
if (!p0 || String(p0.sCode) !== '0') {
  warn('下单失败: ' + (p0 ? p0.sMsg || p0.sCode : '无返回'));
  console.log('  常见原因：名义金额低于该币种最小下单量（BTC 约 7.7U 起），或杠杆/持仓模式参数不适用。' +
    '可试试 --amountUsdt 20。');
  process.exit(3);
}
const ordId = p0.ordId;
ok('下单成功 ordId=' + ordId + ' clOrdId=' + p0.clOrdId);

// ---------- 5. 查询 ----------
h('5. 查询订单状态');
const got = runOkx(['swap', 'get', '--instId', INST, '--ordId', ordId], { quiet: true });
const g0 = Array.isArray(got) ? got[0] : got;
if (g0 && g0.state) ok('状态=' + g0.state + ' ｜ 已成交 ' + (g0.accFillSz || '0'));

// ---------- 6. 成交后主程序会做的事（仅打印） ----------
h('6. 成交后主程序会自动挂 OCO 止盈止损（此处只打印，不执行）');
const tp = (last * 1.05).toFixed(6);
const sl = (last * 0.95).toFixed(6);
console.log('    ' + OKX_BIN + ' ' + GLOBAL_ARGS.join(' ') + ' swap algo place --instId ' + INST +
  ' --side sell --ordType oco --tpTriggerPx ' + tp + ' --tpOrdPx=-1' +
  ' --slTriggerPx ' + sl + ' --slOrdPx=-1 --tdMode cross --reduceOnly --closeFraction 1' +
  (BC_ARGS.length ? ' ' + BC_ARGS.join(' ') : ''));
console.log('  （止盈/止损价格是主程序按配置和结构位算出来的，这里只是固定示例值）');

// ---------- 7. 撤单 ----------
h('7. 撤销刚才的单');
const cancelled = runOkx(['swap', 'cancel', '--instId', INST, '--ordId', ordId], { quiet: true });
const c0 = Array.isArray(cancelled) ? cancelled[0] : cancelled;
if (c0 && String(c0.sCode) === '0') ok('已撤单');
else warn('撤单返回异常，请到 OKX 手动确认该单是否还挂着（ordId=' + ordId + '）');

console.log('\n示例结束。核心就三件事：用官方 CLI、参数用数组拼、Builder Code 放在下单参数末尾。');
