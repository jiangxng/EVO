# EVO PRC Accounting Regulatory Baseline — 2026-09-22 v0.1

Status: AUTHORITATIVE RESEARCH BASELINE / IMPLEMENTATION INPUT
Jurisdiction baseline: PRC enterprise accounting, accounting software and electronic accounting evidence

## 1. Core conclusion

EVO's event-first direction is compatible with PRC accounting rules, but statutory finance needs an explicit layer after the Economic Runtime:

Enterprise Business → canonical BusinessData → operational/economic ledgers → balances/cost/settlement → accounting recognition → double-entry General Ledger → Trial Balance → financial statements.

Operational ledgers remain signed increase/decrease ledgers. Statutory General Ledger journals must use explicit Debit/Credit and must balance.

## 2. Requirements that were not explicit enough before this review

1. Business occurrence is not automatically accounting recognition. Sales orders, purchase orders, shipment, receipt, invoice, payment, return and refund can be canonical business facts without immediately becoming a statutory GL journal. Recognition is controlled by pinned accounting policy.
2. A complete statutory financial statement package is broader than the three familiar statements. It includes Balance Sheet, Income Statement, Cash Flow Statement, Statement of Changes in Equity and Notes.
3. Accounting year/period/close/reopen need explicit governance. PRC statutory accounting year is January 1 to December 31.
4. Backdated BusinessData may require Economic Runtime Replay, but must not silently rewrite a legally closed GL period.
5. Accounting currency must be explicit. RMB is the default accounting currency; permitted foreign accounting currency still requires RMB financial-report translation.
6. Original evidence and accounting voucher/journal must be separately modeled and linked.
7. Posted vouchers/journals must be immutable in effect: no silent deletion or change of date, currency, FX rate, amount, account or operator.
8. Reconciliation is first-class: book-to-voucher, book-to-book, book-to-physical/cash, book-to-report, and bank reconciliation.
9. Electronic accounting evidence must support authenticity checks, anti-tamper, duplicate-entry prevention, approval/audit, standard data interfaces, archival export, logs, backup and recovery.
10. Cash Flow Statement requires classification policy (operating/investing/financing), not merely summing the Cash ledger.
11. Chart of Accounts must be versioned accounting metadata, separate from generic LedgerDefinition.
12. Accounting policy changes require effective dates, reasons, transition/restatement rules and disclosure impact.
13. Financial statement mapping must support comparative periods, materiality, aggregation/disaggregation and explicit no-inappropriate-offsetting rules.
14. Accounting archive retention/security/export are lifecycle requirements; retention is record-type/jurisdiction metadata, not one hard-coded duration.
15. Accounting roles require incompatible-duty controls. Business operator, approver, accounting preparer, reviewer/poster, cashier, custodian and auditor cannot be freely collapsed into one role.
16. Multi-enterprise runtime does not automatically mean consolidated financial statements; consolidation needs a separate governed projection.

## 3. Accounting recognition boundary

Examples:
- sales_order.approved can create operational pending-production/pending-shipment/receivable positions without automatically recognizing statutory revenue;
- purchase_order.approved can create operational pending-purchase/payable positions without automatically recognizing statutory inventory/expense/AP;
- later accounting recognition uses AccountingRecognitionRule pinned to an accounting policy/version.

Required chain:
BusinessData → Original Evidence → Evidence Validation → Accounting Recognition → Accounting Voucher/Journal → Debit/Credit Lines → GL → Trial Balance → Reports.

## 4. Accounting period and close

Minimum concepts:
- AccountingBook
- AccountingYear
- AccountingPeriod: OPEN / SOFT_CLOSED / CLOSED / REOPENED_WITH_AUTHORIZATION
- period-posting authorization
- adjusting-entry policy
- close/reopen audit trail.

Closing must be blocked until required vouchers are posted. Ordinary posting to a closed period is blocked. Reopen or adjustment requires authority and durable evidence.

## 5. General Ledger minimum contract

- Chart of Accounts / AccountingAccount
- Journal
- JournalLine
- side = DEBIT | CREDIT
- accounting amount and accounting currency
- source BusinessData/evidence lineage
- pinned accounting policy/rule version
- at least one debit and one credit line
- sum(debit) = sum(credit) under declared precision
- unbalanced journal fails atomically
- Trial Balance independently recomputable
- Full Replay reproduces GL and Trial Balance.

## 6. Reconciliation family

Required future controls:
- voucher ↔ journal/GL;
- AR/AP/Inventory/Cash economic positions ↔ corresponding GL accounts;
- bank statement ↔ bank/cash ledger;
- physical inventory/cash count ↔ accounting books;
- GL ↔ Trial Balance ↔ financial statements.

Any difference must be an explicit reconciling item, never hidden by overwriting balances.

## 7. Financial reporting roadmap correction

Product shorthand may continue to call Balance Sheet + Income Statement + Cash Flow Statement the 'three core statements'.

But statutory readiness targets:
1. Balance Sheet
2. Income Statement
3. Cash Flow Statement
4. Statement of Changes in Equity
5. Notes / disclosures
plus comparative-period data and governed presentation policies.

The 2026 revised ASBE No.30 is phased in from 2027/2029/2030 depending on enterprise type, with early adoption allowed. EVO should therefore version report-presentation policy by effective date.

## 8. Notes/disclosures

Notes should not be only manually typed documents. Where possible they should be generated from versioned DisclosureDefinition + source data + calculation + narrative evidence.

Future disclosure metadata should cover accounting policies, policy changes, material judgments, contingencies, statement-line breakdowns, related parties, going concern and other standard-specific disclosures.

## 9. Electronic vouchers and archives

PRC rules now explicitly require accounting software to support electronic accounting vouchers and national electronic-voucher data standards.

EVO should provide plugin/adapter ingestion for digital invoices, VAT e-invoices, bank receipts/statements, travel tickets, fiscal electronic receipts and other standardized evidence.

Archive policy must preserve authenticity, integrity, usability, security, metadata, anti-tamper, backup and governed destruction/retention extension.

## 10. Red invoice

Red invoice remains a simple canonical business event, not a tax platform.

Minimum canonical metadata should preserve:
- source blue-invoice identity;
- full vs partial red issuance;
- red amount/quantity;
- tax-platform confirmation/status when applicable;
- document/evidence reference/hash;
- accounting-recognition lineage.

Do not build a giant tax engine, but do not discard legally relevant invoice evidence.

## 11. Internal controls

Accounting authorization must support incompatible-duty policies. AI actors follow the same controls as humans/automation. An AI may prepare/propose a journal if authorized, but must not implicitly gain review/posting/payment authority.

## 12. Updated finance gates

Gate A — Economic Runtime: BusinessData, rules, economic ledgers, balances, cost/valuation, allocation and Replay.
Gate B — General Ledger: Chart of Accounts, Journal, Debit/Credit, atomic balance, evidence lineage, accounting currency and period.
Gate C — Accounting operations: review/approval, close/reopen, bank and subledger reconciliation, posted-history immutability, electronic voucher/archive.
Gate D — Trial Balance: debit=credit and independently reconciled balances with Replay equality.
Gate E — Financial reporting: three core statements plus Statement of Changes in Equity and Notes.

## 13. Source baseline

- Accounting Law of the PRC (2024 revision).
- Accounting Standards for Business Enterprises — Basic Standard.
- ASBE No.30 — Presentation of Financial Statements (2014 baseline; 2026 revised phased standard).
- Accounting Software Basic Functions and Services Specification, 财会〔2024〕12号.
- Accounting Informatization Work Specification, 财会〔2024〕11号.
- Accounting Archives Administration Measures, MOF/National Archives Administration Order No.79.
- 财会〔2020〕6号 electronic accounting voucher reimbursement/booking/archiving rules.
- 2025 nationwide Electronic Accounting Voucher Data Standards.
- STA Announcement No.11 of 2024 and related digital red-invoice guidance.
- Basic Standard for Enterprise Internal Control, 财会〔2008〕7号.

Research conclusion: EVO should continue business-event certification while building the formal accounting layer in parallel. Financial statements must emerge from real enterprise facts through governed accounting recognition, balanced journals and reconciliation—not from a separate report-only data system.
