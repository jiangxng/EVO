# EVO 横向 / 纵向扩展验证原则 v0.1
# EVO Horizontal / Vertical Expansion Validation Principle v0.1

**Status: AUTHORITATIVE ARCHITECTURE VALIDATION PRINCIPLE**  
**Date: 2026-09-22**  
**Scope: Enterprise Template / Application Model / Transaction Type / Field Model / Conditional Posting / Ledger extensibility**

## 1. 目的

EVO 的目标不是证明少数预选业务可以运行，而是证明核心抽象可以持续承载真实企业不断增加的业务能力。

企业模板因此不只是导入 / 导出功能，而是 EVO 横向扩展能力的主要验收载体：

> 用大量、异构、真实的企业应用持续验证 Transaction Type、Application、Field / Field Group、Conditional Posting、Ledger 等核心抽象是否足够通用。

Asloop 已积累的大量真实企业应用与配置资产，应作为 EVO 第一批企业应用语料库和验证样本。目标是提炼业务语义，不是机械迁移旧表、旧 Controller 或旧 SQL。长期覆盖目标应接近 APQC 所描述的企业全流程范围，并进一步扩展到多行业企业模板。

## 2. 两个正交的扩展方向

### 2.1 横向扩展 / Horizontal Expansion

横向扩展回答：EVO 能否不断增加新的交易类型、应用、字段、字段组、账本和业务流程，而不要求为每个新业务重写 Core？

基本链路：

    Transaction Type
    → Application
    → Field Group
    → Fields
    → Command / BusinessData
    → Conditional Posting Rules
    → One or More Ledgers
    → Balance / Work / Projection

横向扩展至少覆盖 Transaction Type、Application、Field / Field Group、Ledger、Posting Rule、Workflow / Work / Projection、APQC Process / Capability 和行业模板的持续增加。

### 2.2 纵向扩展 / Vertical Expansion

纵向扩展回答：同一份 canonical BusinessData 能否在不修改历史事实的前提下，通过增加或版本化规则，被继续解释到更多业务、成本、管理和财务层次？

典型链路：

    Canonical BusinessData
        ├─ Conditional Posting → Operational Ledger → Balance / Work
        ├─ Conditional Posting → Inventory / Cost / Valuation
        ├─ Accounting Recognition → Journal / GL → Trial Balance → Financial Statements
        └─ Future governed projections → Management / Regulatory / Industry views

纵向扩展的核心不是增加硬编码处理器，而是增加条件、规则、目标账本 / 投影、维度和版本化解释；必要时通过 Replay / Re-posting 重新解释历史 BusinessData。历史 BusinessData 本身不得为了新的纵向解释而被改写。

## 3. Enterprise Template 的验证角色

Enterprise Template 应被视为 Enterprise Definition Dataset，而不只是 UI 配置或安装文件。

一个可安装企业模板应能够包含或引用至少以下定义资产：Transaction Types、Applications、Field Groups、Fields、Commands / Business Events、Workflow / Work definitions、Ledgers、Dimensions、Conditional Posting Rules、Calculation / Valuation / Cost Policies、Accounting mappings / policies、Views / Lists / Forms、Dependencies、APQC capability mappings、Version / Semantic Digest。

模板安装后的企业必须能够真实运行这些定义，而不是只恢复菜单或静态元数据。

## 4. Application Expansion Without Core Modification

EVO 长期追求：新增企业业务能力，原则上通过安装或定义新的 Application / Transaction Type / Field / Rule / Ledger 完成，而不是修改 EVO Core。

销售订单、采购入库、生产领料、生产入库、库存盘点、费用报销、固定资产折旧、固定资产处置、MRP 需求、质量检验等能力，原则上都不应要求出现与业务名称绑定的 Core Runtime。

如果现有原语无法表达新业务，可以扩展 Core，但必须先证明：

1. 缺失的是跨多个应用共同需要的通用语义；
2. 现有 Application / Metadata / Rule / Ledger 原语无法简单表达；
3. 新 Core abstraction 不绑定某个具体行业或业务名称；
4. 新能力有至少一个真实应用验收场景；
5. 增加后由自动化测试证明既有模板 / 应用没有回归。

## 5. Ledger 横向扩展原则

Ledger 是可扩展企业状态容器，而不是预先写死的一组 ERP 科目。

可以持续增加 Pending Production、Pending Purchase、Pending Shipment、Receivable、Payable、Inventory、Cash、WIP、Quality Hold、Fixed Asset、Depreciation、Project Cost 以及未来行业特定 Ledger。

新增 Ledger 不应要求修改 Ledger Core。Ledger 的语义、维度、measurement 和允许的 Posting Rule 应由定义和契约决定。

## 6. Conditional Posting 的横向与纵向作用

Conditional Posting 是 Application 与 Ledger 之间的关键解耦层。

横向上，同一种 Runtime 必须能够承载更多不同业务规则，而无需把“销售订单”“固定资产折旧”等业务名称写入 Posting Core。

纵向上，同一 BusinessData 可以在不同治理规则下继续形成 operational posting、costing / valuation、accounting recognition、GL 和 financial statement 等解释。后续增加新的合法规则版本时，可以基于原 BusinessData 重新记账 / Replay，而不是修改历史事实。

## 7. Asloop 的角色

Asloop 在 EVO 中的主要角色定义为：**Enterprise Application Corpus / 企业应用语料库**。

重点提炼：已有交易类型、应用、字段与字段组、表单 / 列表 / 模板配置、条件与表达式、制造 / 销售 / 采购 / 库存 / 项目 / 财务业务语义、业务连接关系、会计 / 凭证 / 现金流语义，以及固定资产折旧等长期运行过的企业应用经验。

迁移原则：Preserve business semantics → Reject accidental legacy coupling → Re-express through EVO primitives → Verify by executable evidence。

不得把旧数据库结构本身视为 EVO 的目标模型。

## 8. 第一批横向压力测试必须异构

第一批应用不能只选择结构类似的订单类业务。建议至少覆盖：销售订单、采购入库、生产领料、生产入库、客户收款、固定资产折旧、库存盘点、费用报销、MRP 需求、质量检验。

这些样本分别压力测试多行交易、库存与应付、WIP、成本、Allocation、周期计算、差异业务、审批、计划型业务和条件 / 状态驱动业务。

如果这些异构应用可以由同一组 Core primitives 表达，才构成有意义的横向扩展证据。

## 9. 企业模板分级认证目标

- Level 0 — Primitive Proof：少量应用证明安装和运行机制成立。
- Level 1 — Heterogeneous Application Proof：至少 10 类性质明显不同的应用使用同一 Runtime。
- Level 2 — Major Enterprise Loops：覆盖销售、采购、库存、生产、资金、费用、资产等主要闭环。
- Level 3 — Asloop Application Corpus：系统性提炼和承载 Asloop 已积累的主要企业应用语义。
- Level 4 — APQC-like Enterprise Coverage：以 APQC Process / Capability 映射显示企业应用覆盖与缺口。
- Level 5 — Multi-industry Templates：通过多个行业模板证明 EVO 不依赖某个单一行业模型。

## 10. 每个横向扩展应用的最低证据

每新增一个用于架构认证的 Application，至少验证：

1. Transaction Type 可由定义安装；
2. Application 可由模板安装；
3. Field Group / Fields 可由模板安装；
4. 字段保持业务语义，而不是退化为无语义 JSON；
5. BusinessData 可产生并保持不可静默改写；
6. Conditional Posting Rule 可配置；
7. 一个业务事件可按条件写入一个或多个 Ledger；
8. 新 Ledger 可在不修改 Ledger Core 下增加；
9. Ledger Entry / Balance 可解释并可追溯；
10. Replay / Re-posting 后结果确定；
11. 应用卸载 / 升级边界明确；
12. 新应用原则上没有修改 EVO Core。

如果必须修改 Core，必须记录原因并判断该能力是否真正通用。

## 11. 长期可观察指标

EVO 应逐步能够从机器可读数据回答：当前有多少 Transaction Types、Applications、Field / Field Groups、Ledger、Conditional Posting Rules；一个 Application 使用哪些 Ledger；一个 Ledger 接收哪些 Applications 的 Posting；一个 BusinessData 经历哪些纵向投影；当前覆盖哪些 APQC Process / Capabilities；哪些应用来自 Asloop 语义迁移；哪些新增应用需要修改 Core；哪些 Core 修改由多个应用共同证明有必要。

## 12. 架构成功判据

横向成功：更多 Transaction Types + Applications + Fields + Ledgers + 企业流程，而 Core 保持稳定。

纵向成功：同一 BusinessData + 更多条件式规则 + 更多 Ledger / Cost / Accounting / Report projection，而历史事实保持稳定。

> **横向扩展用于证明 EVO 的业务抽象广度；纵向扩展用于证明 EVO 的记账 / 投影深度；Enterprise Template 用于把两种能力组合成可安装、可复制、可验证的完整企业定义。**