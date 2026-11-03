# 安装与配置

本文档面向最终用户，说明如何在自己的机器上部署 OKX Quant Radar。

> 当前不提供公开下载。需要安装包请通过 [Issues](https://github.com/cnjuly1993/okx-quant-radar/issues) 联系。
> **首次使用请务必先跑模拟盘（demo），确认信号、下单、止盈止损都正常后再切实盘。**

---

## 1. 运行环境

| 项 | 要求 |
|---|---|
| Windows | Windows 10 / 11（64 位） |
| Linux | 任一主流发行版（Debian / Ubuntu 系最省事），建议 1 核 1G 以上 VPS |
| 运行时 | Node.js ≥ 18（LTS 即可） |
| 交易所工具 | OKX 官方命令行 `@okx_ai/okx-trade-cli` |
| 网络 | 能访问 OKX 接口；建议固定公网 IP 并配置到 API Key 白名单 |

Node.js 与 OKX 命令行缺失时，程序启动会直接提示对应的安装命令，**不会带着残缺环境硬跑**。

---

## 2. 创建 OKX API Key（重要）

1. 登录 OKX → 账户 → API 管理 → 创建 API Key
2. 权限**只勾选「读取」和「交易」**
3. ⚠️ **绝对不要勾选「提币」**
4. 建议绑定 IP 白名单（填你的 VPS 公网 IP，或家里宽带的固定 IP）
5. 记下 API Key / Secret Key / Passphrase，填到本机配置里

> 建议单独开一个**子账户**给本程序使用，只放你愿意承担风险的资金，与主账户隔离。

---

## 3. Windows 部署

1. 运行 `OKX-Quant-Windows.exe`
2. 首次启动会自检 Node.js 与 OKX 命令行；缺失时按提示安装：
   - Node.js：`winget install OpenJS.NodeJS.LTS`
   - OKX 命令行：`npm install -g @okx_ai/okx-trade-cli`
3. 默认使用 `demo` 这个账户 profile（**模拟盘**，余额是虚拟的）
4. 在控制台里打开配置页，填入你的 API Key 并保存
5. 点「开始」即可运行；控制台可随时停止

切换实盘：

```bat
OKX-Quant-Windows.exe --profile=你的实盘profile名
```

实盘启动会先显示警告并要求输入 `yes` 确认（不想每次输就加 `--live-ok`）。

> Windows 版适合本地验证；关机或休眠后程序停止。需要 7×24 运行请用 Linux 版。

---

## 4. Linux 部署

```bash
tar -xzf okx-strategy-1.0.0.tar.gz
cd okx-strategy-1.0.0
sudo bash install.sh
```

安装脚本会依次完成：检测 / 安装 Node.js → 安装 OKX 命令行 → 生成本账户的命令包装脚本 → 注册 systemd 服务。

常用命令：

```bash
systemctl status  <服务名>      # 查看运行状态
systemctl restart <服务名>      # 重启（改配置后需要）
journalctl -u <服务名> -f       # 跟踪日志
```

---

## 5. 配置说明

配置文件为 JSON，主要区块：

| 区块 | 作用 |
|---|---|
| `rules` | 策略开关、杠杆、每轮/每日开单上限、持仓上限、币种白名单/排除名单 |
| `risk` | 单笔名义金额、止盈止损百分比、挂单距离、动态保护、防爆保护 |
| `builder` | `aiBuilderCode`：接入 OKX AI Builder Program 的归因代码，留空则不下发该参数 |
| `dynProtect` | 动态止盈止损（锁盈阶梯、止盈跟随、回撤保护） |

> ⚠️ **策略主程序只在启动时读取一次配置文件**，改完配置必须重启服务才生效；
> 但控制台上的「暂停开单 / 恢复开单」开关是按轮询生效的，不需要重启。

---

## 6. 验证清单

切实盘之前，按这个顺序确认：

- [ ] 模拟盘跑通至少一轮，能看到信号与候选标的
- [ ] 模拟盘实际开出过单，且止盈止损单被正确挂上
- [ ] 控制台的「暂停开单」能立即拦住新开仓，但已有持仓的止盈止损照常工作
- [ ] 实盘第一笔用最小名义金额（建议 ≤ 10 USDT）
- [ ] 确认订单在 OKX 网页 / App 里能查到，风控单（止盈止损）也在

---

## 7. 停止与卸载

- 停止：控制台点「停止」，或 `systemctl stop <服务名>`
- 卸载（Linux）：`systemctl disable --now <服务名>`，然后删除安装目录
- 本程序**不会**在 OKX 上留下任何托管授权；删掉本机文件即彻底移除
- 建议同时去 OKX 删除对应的 API Key
