# 示例代码

这里只放**接口集成示例**，不含任何交易策略逻辑。

## minimal-demo.js

演示「通过 OKX 官方命令行完成一笔完整交易闭环」，以及 AI Builder Code 归因参数是怎么带上的：

| 步骤 | 做什么 | 需要 API Key |
|---|---|---|
| 1 | 检查 OKX 命令行是否可用 | — |
| 2 | 读取行情 | 不需要（公开接口） |
| 3 | 读取账户权益与持仓 | 需要 |
| 4 | 下一笔远离市价的限价单（带 `--aiBuilderCode`） | 需要 |
| 5 | 查询订单状态 | 需要 |
| 6 | 打印「成交后主程序会挂的 OCO 止盈止损命令」（仅打印，不执行） | — |
| 7 | 撤销刚才的单 | 需要 |

### 先看它会做什么（不下单）

```bash
node examples/minimal-demo.js
```

默认就是 dry-run：只打印将要执行的命令，不会碰到账户。

### 只读模式（验证账户链路）

```bash
node examples/minimal-demo.js --read
```

### 在模拟盘真的下一笔再撤掉

```bash
node examples/minimal-demo.js --place --demo --amountUsdt 20
```

带归因参数：

```bash
node examples/minimal-demo.js --place --demo --amountUsdt 20 --aiBuilderCode 你的CODE
```

### ⚠️ 安全设计

- **默认 dry-run**，不加 `--place` 绝不下单
- 加 `--place` 但没指定 `--demo` 会**直接拒绝执行**；确实要走实盘必须再加 `--yes-live`
- 下单价格取市价的 90%，正常情况下不会成交，执行完立刻撤单

### 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `--place` | 关 | 真正下单（配合 `--demo` 或 `--yes-live`） |
| `--dry` | 开 | 强制 dry-run |
| `--read` | 关 | 只读模式，查完行情和账户就结束 |
| `--demo` | 关 | 走模拟盘（虚拟资金） |
| `--yes-live` | 关 | 确认走实盘的二次确认 |
| `--profile` | CLI 默认 | OKX 命令行的账户 profile 名 |
| `--instId` | `BTC-USDT-SWAP` | 标的 |
| `--amountUsdt` | `20` | 名义金额。**注意各币种有最小下单量，BTC 约 7.7 USDT 起** |
| `--aiBuilderCode` | 环境变量或空 | AI Builder 归因代码（1–16 位字母数字） |

## 实测记录

以下路径已在 OKX **模拟盘**上跑通（`--place --profile demo --demo --amountUsdt 20 --aiBuilderCode TESTABC123`）：

```
✓ 下单成功 ordId=4065842742035992576 clOrdId=DEMO3673955546
✓ 状态=live ｜ 已成交 0
✓ 已撤单
```

顺带验证了两件事：

1. **带 `--aiBuilderCode` 不影响下单**：归因参数只是订单上的一个附加字段，交易行为与不带完全一致。
2. **填错或未激活的 Code 不会导致下单失败** —— 但这也意味着**归因会静默失败**。所以填完 Code 一定要去 OKX AI Builder 工作台核对是否识别到了对应交易。下单成功 ≠ 成交 ≠ 计返佣。

## 为什么这里没有完整程序

完整程序包含策略信号、风控闸门、仓位管理和调度，是本项目的核心资产，通过私有交付提供，不在公开仓库发布。

这份仓库提供的是：项目说明、使用文档、以及**可以自己跑通验证**的接口集成示例。
