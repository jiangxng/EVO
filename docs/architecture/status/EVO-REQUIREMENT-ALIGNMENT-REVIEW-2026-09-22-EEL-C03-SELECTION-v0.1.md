# EVO Requirement Alignment Review — 2026-09-22 — Post EEL-C02 / EEL-C03 Selection v0.1

**Status:** ALIGNED / NEXT BUSINESS LOOP SELECTED  
**Date:** 2026-09-22  
**Stage:** Stage E — Enterprise Economic Loops

## 0. 60 秒业务摘要

EEL-C01 已证明：

```text
客户下单 → 企业履约 → 客户付款 → 应收关闭 → 现金增加 → Replay 一致
```

EEL-C02 已证明：

```text
企业采购 → 收货 → 库存增加 → 供应商付款 → 应付关闭 → Replay 一致
```

两条闭环都主要验证了“正向发生”。

下一步最值得验证的不是继续扩展正向流程，而是：

> 当真实企业业务发生退货、退款、冲回时，EVO 能不能仍然坚持“历史不改写、后续事实修正状态”，并让库存、资金、待办与 Replay 都保持一致？

因此选择：

```text
EEL-C03 — Sales Return / Exchange / Refund / Red Invoice Reference Loop
```

## 1. 最终目标有没有变化？

没有。

EVO 仍然是：

> AI-Native、可生长、模块化、行业无关的企业运行底座，让企业业务可以被描述、执行、解释、重演、升级和持续演进。

## 2. Stage E 业务目标有没有变化？

没有。

Stage E 仍然验证：

> 已经认证的经济运行内核，是否足以表达真实企业端到端业务闭环，而不是继续建设底层基础设施。

## 3. 为什么 EEL-C03 选择 Sales Return & Refund？

当前已有两个认证闭环都属于正向业务流：

- EEL-C01：销售到收款；
- EEL-C02：采购到付款。

但企业系统必须同样处理“业务反向发生”：

- 客户退货；
- 客户换货；
- 商品重新进入库存；
- 原销售相关义务/经济状态被反向抵消；
- 如果客户已经付款，企业需要退款；
- 如果原销售需要反向票据表达，企业需要新增红字发票事件；
- 原订单、原发货、原收款历史不能被修改；
- 退货和退款必须明确关联原业务；
- Replay 后结果仍必须一致。

这直接检验 EVO 最重要的业务原则之一：

> **修改、作废、退货、退款、冲回，不靠改历史，而靠新增事实表达。**

## 4. 为什么现在不优先做别的候选？

### Production / Make-to-Stock

现有 O2C 已经覆盖 Production Completion、Inventory 增加和 FIFO Cost 的参考路径。

继续做纯生产正向闭环会增加业务覆盖，但对核心抽象的挑战与现有证据重叠较大。

### Three-way Match / Supplier Invoice

有业务价值，但容易把当前阶段带向采购发票、税务、匹配异常、审批等更大的业务域。

在证明“反向业务事实”之前，不值得先承担这一层复杂度。

### Bank Reconciliation

属于资金控制的重要业务，但依赖银行外部事实、匹配策略、未达账项等新的业务边界。

当前更优先证明基础事实模型能否正确处理业务反向变化。

## 5. EEL-C03 业务故事

参考闭环：

```text
Sales Order
→ Shipment
→ Customer Payment
→ Sales Return / Exchange
→ Inventory / Replacement Movement
→ Customer Refund
→ Cash Decrease
→ Red Invoice
→ Return / Refund Work Closure
→ Full Replay Equality
```

关键要求：

1. 原 Sales Order 不修改；
2. 原 Shipment 不修改；
3. 原 Customer Receipt 不修改；
4. Sales Return 是新的 BusinessData；
5. Sales Exchange 是新的 BusinessData；
6. Customer Refund 是新的 BusinessData；
7. Red Invoice 是新的 BusinessData；
8. Return / Exchange 必须明确指向原销售/发货/退货来源；
9. Refund 必须明确指向被退款的原收款/客户经济来源；
10. Red Invoice 必须明确指向原票据/原销售经济来源；
11. 库存通过新增事实恢复或发生替换移动；
12. 现金通过新增退款事实减少；
13. Replay 后正式经济结果一致。

## 6. 当前先不要求

EEL-C03 暂不扩展为完整售后平台。

不要求：

- 维修；
- RMA 审批平台；
- 退货运费；
- 税控接口与复杂法定税务计算；
- 信用票据/credit memo 产品化；
- 多订单混合退款；
- 部分商品多次退款的复杂分摊；
- 手续费；
- 拒付/chargeback；
- 跨币种退款；
- 原因码统计产品化；
- 客服工单系统。

这些未来可以独立进入业务 packet。

## 7. 反过度设计四问

### 是否需要新的 Return Runtime？

当前没有证据需要。

已有：

- BusinessData；
- Posting Rule；
- Ledger；
- BusinessObjectLink；
- AllocationInstruction；
- WorkProjection；
- Replay。

优先复用。

### 是否需要通用 Reversal Engine？

当前没有证据需要。

退货/退款本质上可以先由明确的新业务事实和反向 Posting 表达。

### 是否需要修改原销售订单/发货/收款？

明确禁止。

### 是否需要现在建设 Credit Memo / RMA / After-sales Platform？

不需要。

但这不代表换货和红字发票延后。二者作为简单业务事件当前就要进入 EEL-C03：

- 换货：新增 exchange fact + 显式关联 + 正常库存/发货事实；
- 红字发票：新增 red-invoice fact + 显式关联 + 需要时通过 Posting Rule 表达经济冲回。

只有当前验收无法通过时才允许扩展。

## 8. EEL-C03 建议 bounded slices

### C03.1 — Sales Return Economic Recognition

证明：

- `sales_return.received`；
- 明确关联原销售/发货；
- Inventory 增加；
- 原销售/发货 BusinessData 不变。

### C03.2 — Sales Exchange

证明：
- canonical exchange fact；
- 明确关联原销售/退货；
- 替换发货/库存变化通过现有业务事实表达；
- 原业务事实不修改。

### C03.3 — Customer Refund

证明：

- canonical refund fact；
- Cash 减少；
- 明确关联原收款/退货；
- 不修改原 `cash.received`。

### C03.4 — Red Invoice

证明：
- canonical red-invoice fact；
- 明确关联原票据/销售来源；
- 原票据/原业务事实不修改；
- 如需经济冲回，由明确 Posting Rule 表达。

### C03.5 — Balance / Work Closure

证明：

- 退货/退款相关待办由余额或 Projection 正确关闭；
- 不以“存在退货事件”代替余额状态。

### C03.6 — Full Replay Equality

证明：

- 正向销售 + 反向退货/退款在 Full Replay 后一致；
- canonical BusinessData 不变；
- explicit relations 保持。

### C03.7 — Final Certification

形成 EEL-C03 certification 与最终需求对齐。

## 9. 当前判断

**REQUIREMENT_DRIFT:** 未发现。  
**SCOPE_DRIFT:** 未发现。  
**OVERDESIGN_RISK:** 当前可控，明确禁止提前建设通用售后/冲销平台。  
**COMPREHENSION_GAP:** 当前业务故事可以直接用企业语言解释。  
**STATUS_DRIFT:** EEL-C02 已通过 post-merge cleanup 修复。

## 10. 下一步

开始 EEL-C03 business packet。

技术实现前必须先检查：

- enterprise-core-v1 已有 `sales-return` 语义；
- 当前 inventory / receivable / cash posting 是否足够；
- 是否已有可复用 refund/cash-outflow 事实；
- 现有显式关系机制是否足够。

只有当前验收明确阻塞时才新增核心抽象。


## 11. 财务主线重新确认

用户明确确认 EVO 当前阶段的主顺序：

```text
企业业务
→ 业务事件
→ 账本
→ 余额
→ 三大财务报表
```

这一确认意味着：

- 当前 Stage E 优先继续覆盖真实企业业务事件；
- 每个事件必须能通过规则进入业务/财务账本；
- 余额必须由账本累计得到并可 Replay；
- 三大财务报表是后续建立在完整财务账本上的投影，而不是新的事实系统；
- 不为了报表提前扭曲业务事件模型；
- 不为了“传统 ERP 模块长什么样”而提前制造复杂模块。

未来三大报表目标：

- Balance Sheet；
- Income Statement；
- Cash Flow Statement。

进入该阶段前，应先证明主要企业业务的经济事件已经有足够完整的财务账本表达。
