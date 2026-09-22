# EVO 业务需求基线 v0.1
# EVO Business Requirement Baseline v0.1

**状态 / Status: AUTHORITATIVE BUSINESS INTENT BASELINE**  
**日期 / Date: 2026-09-22**  
**Authority scope: what EVO must achieve in business terms; not a technical design mandate**

## 1. 这份文档解决什么问题

EVO 是 LLM 原生项目，技术选型、架构拆分和实现方式可以由 LLM 主导。

但“由 LLM 主导技术”不等于“由技术细节反过来定义需求”。

本文件用于保证：

> 即使项目长期由不同能力、不同偏好的 LLM 接力，技术方案仍必须持续服务已经确认的业务目标，而不是因为模型更熟悉某种技术就把项目带向那个方向。

## 2. 人与 LLM 的职责边界

### 人负责

- 企业最终需要什么能力；
- 什么结果算业务成功；
- 哪些约束不能违背；
- 哪些体验、可解释性和管理能力是必要的；
- 当业务目标发生变化时，明确提出变化。

### LLM 负责

- 技术选型；
- 架构设计；
- 模块拆分；
- 数据模型；
- 接口设计；
- 测试与验证方法；
- 性能、可靠性和演进方案。

### 双方共同负责

定期回答：

> 当前技术工作是否仍然直接服务已确认业务目标？  
> 是否出现遗漏需求、误解需求或为了“以后可能有用”而提前做了过多基础设施？

## 3. EVO 最终业务目标

EVO 不是“做很多 ERP 模块”。

EVO 的最终目标是：

> **成为 AI-Native、可生长、模块化、行业无关的企业运行底座，让企业业务可以被描述、执行、解释、重演、升级和持续演进。**

长期必须能够支撑：

- 销售、采购、库存、生产；
- 应收、应付、资金、成本、财务；
- 流程、SOP、工作任务；
- 企业管理数据与经营分析；
- 行业模板与企业个性化；
- AI Agent / LLM 安全地操作企业业务。

## 4. 不变的核心业务原则

以下原则优先于局部技术便利：

1. **业务历史不能因为技术实现方便而被静默改写。**
2. **企业为什么得到某个余额、成本、任务或结果，必须可解释。**
3. **规则、政策、算法变化后，历史可以被重新解释和重算。**
4. **重算结果必须可以被独立验证。**
5. **不同 LLM 接手后，不应依赖聊天记忆理解项目。**
6. **技术复杂度必须有当前业务需求作为理由。**
7. **“未来可能有用”本身不足以成为当前实现理由。**
8. **企业业务能力优先于技术名词和框架本身。**

## 5. 当前 Stage E 的业务目标

Stage E 的目标不是继续扩建 Replay 基础设施。

Stage E 要回答：

> **EVO 能不能用已经认证的经济运行内核，完整表达真实企业业务闭环？**

当前第一个闭环：

### EEL-C01 — Order-to-Cash Settlement Reference Loop

业务语言的完整验收是：

1. 客户下单后，企业知道要生产/发货什么、还要收多少钱；
2. 完成生产和发货后，相关待办正确关闭；
3. 客户付款后，系统知道实际收到多少现金；
4. 系统知道这笔现金明确结清了哪一笔应收，而不是靠金额或时间猜；
5. 如果应收和现金是不同币种，系统能计算实际汇兑损益；
6. 收清后，“待收款”任务关闭；
7. 删除可重建结果并重新计算后，正式业务结果仍一致；
8. 原始业务事实不因 Replay 被修改。

## 6. 当前明确不要求 EEL-C01 解决的内容

以下内容不是当前 EEL-C01 完成条件：

- 发票/税务法定单据；
- 收入确认复杂政策；
- 部分收款；
- 多付/未分配现金；
- 银行手续费；
- 拒付、退款；
- 银行对账；
- 信用额度和催收工作流；
- 完整 UI / 报表产品化；
- 为所有未来支付场景设计通用结算框架。

这些需求未来可以进入独立 packet，但不得为了“可能以后需要”提前扩大 EEL-C01。

## 7. 技术方案进入实现前的四问

任何重要的新抽象、新模块、新框架或跨模块基础设施，LLM 必须先回答：

1. **当前哪个已确认业务需求需要它？**
2. **如果现在不做，会具体阻塞哪个验收条件？**
3. **已有机制能否以更简单方式满足当前需求？**
4. **这是当前必须，还是仅仅未来可能有用？**

如果第 4 个问题答案是“主要为了未来”，默认延后。

## 8. 汇报规则

以后项目进展默认按三层解释：

### 业务层
企业现在多了什么能力？

### 产品层
未来业务人员/管理者会看到什么行为或结果？

### 技术层
内部用什么机制实现，证据是什么？

技术层不能替代前两层。

## 9. 需求重新对齐触发器

出现以下任一情况，必须执行一次正式需求对齐：

- 一个 Stage 结束或开始；
- 一个完整业务闭环完成；
- 每完成 3 个已通过 DATABASE E2E VERIFIED / CERTIFIED 的 bounded work packet；
- 引入新的核心抽象；
- 引入新的数据库大类；
- 新建跨模块基础设施；
- 打算把局部能力抽象成通用框架；
- 发现用户难以用业务语言判断当前工作价值；
- 用户明确提出“需求对齐 / 是否跑偏 / 是否过度设计”。

## 10. 对齐完成的最低输出

一次需求对齐至少要回答：

- 最终目标有没有变化？
- 当前 Stage 的业务目标是什么？
- 当前 packet 的业务验收条件是什么？
- 已满足哪些？
- 还缺哪些？
- 哪些技术工作是必要设计？
- 哪些是暂缓设计？
- 是否存在疑似过度设计？
- 下一步为什么值得做？



## 11. 企业业务 → 财务报表主链

EVO 的业务与财务能力必须遵循以下主链：

```text
企业业务
→ 业务事件 / BusinessData
→ 记账规则 / Posting Rules
→ 账本 / Ledgers
→ 余额 / Balances
→ 财务报表 / Financial Statements
```

这条主链是业务设计原则，不是某一种技术实现细节。

### 11.1 企业业务

企业真实发生：

- 销售；
- 采购；
- 生产；
- 收货；
- 发货；
- 收款；
- 付款；
- 退货；
- 换货；
- 退款；
- 红字发票；
- 费用；
- 资产变化；
- 其他经营事项。

业务本身是起点。

### 11.2 业务事件

每一个有经济或经营意义的发生，优先表达成新的、不可静默改写的 BusinessData。

例如：

```text
sales_order.approved
goods_receipt.received
cash.received
cash.paid
sales_return.received
sales_exchange.created
sales_red_invoice.issued
```

历史发生不因为后续业务变化而被覆盖。

### 11.3 记账规则

业务事件通过明确的 Posting Rules 进入一个或多个业务/财务账本。

规则回答：

> 什么业务发生后，哪个账本增加或减少多少，使用哪些业务维度？

而不是让业务代码直接维护最终余额。

### 11.4 账本

账本是企业状态的可解释经济/经营容器。

包括但不限于：

- Pending Production；
- Pending Purchase；
- Pending Shipment；
- Receivable；
- Payable；
- Inventory；
- Cash；
- Revenue；
- Expense；
- COGS；
- 后续需要的资产、负债、权益类账本。

### 11.5 余额

余额来自账本发生累计，而不是独立维护的第二套事实。

```text
Balance = Σ Ledger Entries
```

Work、经营状态和管理分析可以由余额进一步投影。

### 11.6 三大财务报表

当企业业务事件、记账规则、账本和余额体系足够完整后，EVO 应能够从正式财务账本生成：

1. **资产负债表 / Balance Sheet**
2. **利润表 / Income Statement**
3. **现金流量表 / Cash Flow Statement**

三大报表是正式账本/余额的派生视图，不建立独立事实来源。

原则：

```text
业务事实是源头
账本是经济解释
余额是累计状态
报表是标准化表达
```

不得为了“让报表数字对上”反向修改 canonical BusinessData。

如果会计政策、科目映射或报表口径变化，应通过版本化规则/映射重新解释和重算，而不是修改历史业务事实。

### 11.7 当前 Stage E 的顺序

当前优先级：

```text
先把企业真实业务跑通
→ 把业务事件跑通
→ 把业务事件正确记入账本
→ 证明余额正确且可 Replay
→ 扩充到足以覆盖企业主要经济活动
→ 再形成三大财务报表
```

因此当前不优先建设“报表系统本身”。

只有账本语义覆盖达到足够完整时，才进入三大报表认证阶段。

### 11.8 财务报表阶段的验收原则

未来进入财务报表阶段时，最低要求包括：

- 报表数字可以追溯到账本；
- 账本可以追溯到 BusinessData；
- 同一 canonical BusinessData 在不同合法会计规则版本下可以重新记账；
- Replay 后财务报表结果可重复；
- 报表之间满足会计恒等关系；
- 管理维度和法定财务口径不得混成不可解释的一套数据；
- 报表映射/科目体系必须版本化、可解释、可审计。

## 12. 业财一体与可安装能力原则

EVO 的重要能力之一是：业财一体、业务财务一体化。

但这不意味着 EVO 是一个以 Finance 为中心的平台。

EVO 的目标是通过统一企业事实、条件式记账、账本抽象和可安装应用 / 包 / 插件，让企业业务结果与财务结果来自同一事实源和同一可解释规则链。

### 12.1 EVO 不是财务平台

EVO 不以“财务模块统领其他模块”为产品结构。财务能力与销售、采购、生产、库存、服务等能力一样，都可以由安装的 Application / Package / Plugin 提供。

### 12.2 平台与应用的职责

平台负责通用能力：BusinessData、Command、Conditional Posting、Ledger / Balance、Relation / Lineage、Allocation、Cost / Valuation、Replay、Work / Projection、Permission / Capability，以及 Accounting Journal balance validation 等通用约束。

应用 / 包负责具体语义：什么业务事件存在、事件字段是什么、哪些条件触发什么业务结果、哪些条件触发会计确认、写哪些业务账本、写哪些财务科目、使用哪些维度和政策。

### 12.3 简单事件不应被包装成复杂平台

换货、红字发票、确认收入、费用计提等，首先应被看成明确的业务 / 会计事件或规则。

只有当前业务验收确实需要复杂审批、外部接口、监管流程或特殊生命周期时，才继续扩展为更大的应用或平台能力。

### 12.4 功能增长的首选方式

新增企业能力时，默认优先级：

1. 新 Application / Package / Plugin
2. 新 Metadata / Event / Rule / Ledger / Projection
3. 复用现有 Runtime
4. 只有现有原语无法满足当前验收时才增加 Core abstraction

因此 EVO 的长期增长目标是：企业功能越来越多，但 Core 仍保持小、稳定、通用。

### 12.5 业财一体的最终判断标准

不是“业务系统和财务系统有接口”。

而是：同一 BusinessData 可以被可解释地投影为业务账本、财务确认 / GL，并都能够追溯回同一企业事实。

业务人员、会计人员、管理者和 AI 应能够从不同视角看到同一企业现实，而不是维护多套互相同步的真相。

## 13. Platform / Application / APQC 三视角原则

EVO 允许同一企业能力被不同角色用不同语言理解。

### 13.1 产品视角

用户可以看到销售平台、供应链平台、制造平台、财务平台等统一工作区。

这些“平台”可以在前端呈现为一个大的统一产品体验。

### 13.2 实现视角

底层优先是多个独立 Application / Package / Plugin 的组合。

每个 App 拥有明确业务边界、事件和接口，并通过 EVO 公共协议协作。

因此：平台可以是应用集合的统一体验，但不能因此要求 Core 增加对应的巨大业务模块。

### 13.3 APQC 视角

APQC 用于描述企业端到端流程和能力覆盖。

推荐统一映射：APQC Process / Capability ↔ EVO Capability ↔ Installed Application / Package ↔ Business Event ↔ Ledger / Work / KPI。

### 13.4 企业能力盘点目标

未来 EVO 应能用数据回答：
- 某企业有哪些业务能力；
- 哪些能力已安装；
- 哪些能力正在实际使用；
- 覆盖哪些 APQC 流程；
- 哪些流程缺 App；
- 哪些 App 已安装但没有运行证据；
- 哪些 Ledger / Work / KPI 支撑某个流程；
- 哪些行业模板可以补齐差距。

### 13.5 行业模板的含义

行业模板不应只是菜单和字段模板。

它可以被定义为：APQC 基础流程 / 行业扩展流程 + EVO Capabilities + Apps / Packages + Event Types + Posting Rules + Ledgers + Work / SOP + KPIs + Experience / UI Composition。

这使行业模板既能描述企业“应该具备什么”，也能落到 EVO “实际安装和运行了什么”。


## 14. 横向 / 纵向扩展验证原则

EVO 不仅要验证少数业务闭环能够运行，还必须持续验证其核心抽象具有足够的横向广度与纵向深度。

### 14.1 横向扩展

横向扩展用于验证：

> 新增 Transaction Type、Application、Field / Field Group、Ledger、Posting Rule、Work / Projection 和 APQC Capability 时，是否仍能复用同一套 Runtime，而不是为每一种业务继续扩展专用 Core。

企业模板是这项能力的主要验收载体。Asloop 已积累的大量真实企业应用应作为第一批 Enterprise Application Corpus，持续压测 EVO 的交易类型、应用设计、字段设计、条件式记账和账本抽象。

长期目标不是只安装几个 Demo App，而是逐步覆盖销售、采购、库存、生产、资金、费用、资产、项目、MRP、质量等主要企业流程，并进一步映射 APQC 和多行业模板。

### 14.2 Ledger 横向扩展

Ledger 本身必须可横向扩展。

新增 Pending Production、Pending Purchase、Receivable、Payable、Inventory、Cash、WIP、Fixed Asset、Depreciation、Project Cost、Quality Hold 或行业专用 Ledger，原则上不得要求修改 Ledger Core。

Ledger 的语义、维度和 measurement 由定义与契约决定。

### 14.3 纵向扩展

纵向扩展用于验证：

> 同一 canonical BusinessData 是否可以在不修改历史事实的前提下，通过增加或版本化 Conditional Posting / Accounting Recognition / Cost / Valuation / Report rules，继续投影到更多业务、管理、成本和财务层次。

典型路径：

```text
BusinessData
→ Operational Ledger / Work
→ Cost / Valuation
→ Accounting Recognition
→ Journal / GL
→ Trial Balance
→ Financial Statements
→ Future Management / Regulatory Projections
```

纵向扩展的默认方式是增加条件、规则、维度、目标 Ledger 或版本化 Projection，而不是增加与具体业务名称绑定的硬编码处理器。

### 14.4 Application Expansion Without Core Modification

新增企业业务能力时，默认优先：

1. 新 Transaction Type；
2. 新 Application；
3. 新 Field / Field Group；
4. 新 Rule；
5. 新 Ledger；
6. 复用现有 Runtime。

只有现有原语无法表达真实业务验收时，才允许新增 Core abstraction，并必须证明该能力具有跨多个应用的通用性。

### 14.5 Enterprise Template 的长期验收意义

Enterprise Template 不只是导入 / 导出格式，而是完整 Enterprise Definition Dataset。

它用于证明：

- 应用可安装；
- 交易类型可安装；
- 字段 / 字段组可安装；
- Ledger 可安装；
- Conditional Posting Rules 可安装；
- 安装后的企业可以真实运行；
- 同一套 Core 可以持续承载更多业务；
- 模板可逐步覆盖 Asloop application corpus、APQC-like 企业流程和多行业能力。

详细架构验证规则：

`docs/architecture/EVO-HORIZONTAL-VERTICAL-EXPANSION-VALIDATION-v0.1.md`
