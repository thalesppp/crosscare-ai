"use client";

import { useEffect, useMemo, useState } from "react";

type CaseRecord = {
  id: string;
  orderNumber: string;
  customerName: string;
  initials: string;
  subject: string;
  channel: string;
  status: string;
  priority: string;
  amountCents: number;
  currency: string;
  trackingStatus: string;
  issueType: string;
  anomalyReason: string;
  recommendation: string;
  replyDraft: string;
  confidence: number;
  policyCode: string | null;
  policyTitle: string | null;
  source: string;
};

const initialCases: CaseRecord[] = [
  { id: "DEMO-1001", orderNumber: "#1001", customerName: "演示客户", initials: "演", subject: "订单 #1001 巡检预警", channel: "演示店铺", status: "待人工确认", priority: "high", amountCents: 8610, currency: "USD", trackingStatus: "pre_transit", issueType: "tracking_inquiry", anomalyReason: "运单已创建，但暂时没有揽收记录；演示规则将该案例标记为需要人工复核。", recommendation: "核实仓库交接状态并向客户说明，处理动作保持人工确认。", replyDraft: "您好，订单 #1001 已生成运单但暂时没有揽收记录。我们会联系仓库核实，并尽快向您更新。", confidence: 96, policyCode: "P-SHIP-01", policyTitle: "物流时效与停滞判断", source: "fictional-demo" },
  { id: "CASE-1005", orderNumber: "#1005", customerName: "Noah Miller", initials: "NM", subject: "Customs delay", channel: "Website", status: "待处理", priority: "normal", amountCents: 12800, currency: "USD", trackingStatus: "in_transit", issueType: "customs_delay", anomalyReason: "等待 Agent 分析", recommendation: "运行 Agent 生成处理建议", replyDraft: "", confidence: 0, policyCode: null, policyTitle: null, source: "demo" },
  { id: "CASE-1003", orderNumber: "#1003", customerName: "Olivia Brown", initials: "OB", subject: "Parcel returned", channel: "Email", status: "待处理", priority: "normal", amountCents: 7600, currency: "USD", trackingStatus: "returned", issueType: "parcel_returned", anomalyReason: "等待 Agent 分析", recommendation: "运行 Agent 生成处理建议", replyDraft: "", confidence: 0, policyCode: null, policyTitle: null, source: "demo" },
  { id: "CASE-1004", orderNumber: "#1004", customerName: "Lucas Martin", initials: "LM", subject: "Delivered but not received", channel: "Email", status: "待处理", priority: "normal", amountCents: 21200, currency: "USD", trackingStatus: "delivered", issueType: "delivered_not_received", anomalyReason: "等待 Agent 分析", recommendation: "运行 Agent 生成处理建议", replyDraft: "", confidence: 0, policyCode: null, policyTitle: null, source: "demo" },
  { id: "CASE-1006", orderNumber: "#1006", customerName: "王琳", initials: "王", subject: "查询物流进度", channel: "站内聊天", status: "待处理", priority: "low", amountCents: 4900, currency: "USD", trackingStatus: "in_transit", issueType: "tracking_inquiry", anomalyReason: "等待 Agent 分析", recommendation: "运行 Agent 生成处理建议", replyDraft: "", confidence: 0, policyCode: null, policyTitle: null, source: "demo" },
];

export default function Dashboard() {
  const [cases, setCases] = useState(initialCases);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monitor, setMonitor] = useState({ scanned: 4, analyzed: 1, alerted: 1 });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const selected = cases.find((item) => item.id === selectedId) ?? null;
  const metrics = useMemo(() => ({
    pending: cases.filter((item) => item.status === "待处理" || item.status === "处理中").length,
    review: cases.filter((item) => item.status === "待人工确认").length,
    resolved: cases.filter((item) => item.status === "自动解决").length,
  }), [cases]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.cases?.length) setCases(data.cases);
        if (data?.latestRun) setMonitor(data.latestRun);
      })
      .catch(() => undefined);
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  async function runMonitorNow() {
    setBusy("monitor");
    try {
      const response = await fetch("/api/monitor/run", { method: "POST" });
      if (!response.ok) throw new Error("云端数据库将在发布后启用");
      const result = await response.json();
      setMonitor(result);
      notify(`巡检完成：检查 ${result.scanned} 个订单，发现 ${result.alerted} 个预警`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "巡检暂时不可用");
    } finally {
      setBusy(null);
    }
  }

  async function runAgent() {
    if (!selected) return;
    setBusy(selected.id);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(selected.id)}/run`, { method: "POST" });
      if (!response.ok) throw new Error("云端数据库将在发布后启用");
      const result = await response.json();
      setCases((current) => current.map((item) => item.id === selected.id ? result.case : item));
      notify("Agent 已完成分析，并写入审计记录");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Agent 暂时不可用");
    } finally {
      setBusy(null);
    }
  }

  async function copyReply() {
    if (!selected?.replyDraft) return notify("请先运行 Agent 生成回复草稿");
    await navigator.clipboard.writeText(selected.replyDraft);
    notify("客户回复草稿已复制");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>✦</span><div><strong>CrossCare</strong><small>AI SUPPORT OPS</small></div></div>
        <nav aria-label="主导航">
          <a className="active" href="#dashboard"><i>⌂</i>工作台</a>
          <a href="#cases"><i>▣</i>售后工单<b>{cases.length}</b></a>
          <a href="#policies"><i>◇</i>政策中心</a>
          <a href="#analytics"><i>↗</i>效果分析</a>
        </nav>
        <div className="sidebar-spacer" />
        <section className="safety"><span>✓</span><div><strong>安全护栏已开启</strong><p>退款、补发与高价值订单始终由人工确认</p></div></section>
        <div className="mode"><span /><div><small>公开演示模式</small><strong>规则 + 政策检索 Agent</strong></div></div>
      </aside>

      <section className="workspace" id="dashboard">
        <header><div><small>PUBLIC DEMO</small><h1>售后指挥中心</h1></div><div className="header-actions"><button onClick={runMonitorNow} disabled={busy === "monitor"}>{busy === "monitor" ? "巡检中…" : "立即巡检"}</button><span className="avatar">PB</span></div></header>
        <section className="hero">
          <div><p className="kicker"><span /> Agent 演示工作流已就绪</p><h2>把异常留给系统，<br/><em>把信任留给客户。</em></h2><p className="hero-copy">CrossCare 通过规则分析问题、读取演示订单与物流、匹配售后政策，并在高风险节点邀请人工接管。</p><button className="primary" onClick={() => setSelectedId(cases.find((item) => item.priority === "high")?.id ?? cases[0]?.id)}>处理优先工单 <span>→</span></button></div>
          <div className="radar" aria-hidden="true"><div className="orbit one"/><div className="orbit two"/><div className="core">✦</div><span className="tag tag-a"><b>订单</b><small>已识别</small></span><span className="tag tag-b"><b>物流</b><small>异常发现</small></span><span className="tag tag-c"><b>政策</b><small>确定性匹配</small></span></div>
        </section>
        <section className="monitor"><div className="monitor-title"><span className="pulse"/><div><small>ON-DEMAND MONITOR</small><strong>按需巡检可用</strong><p>点击运行一次巡检并写入在线审计记录</p></div></div><div><small>累计巡检</small><strong>{monitor.scanned}</strong></div><div><small>规则分析</small><strong>{monitor.analyzed}</strong></div><div><small>异常预警</small><strong className="orange">{monitor.alerted}</strong></div><button onClick={runMonitorNow} disabled={busy === "monitor"}>{busy === "monitor" ? "巡检中…" : "立即巡检"}</button></section>
        <section className="metrics"><article><small>待处理工单</small><strong>{metrics.pending}</strong><p>需要关注的客户问题</p></article><article><small>需要人工确认</small><strong>{metrics.review}</strong><p>Agent 已完成前置调查</p></article><article><small>自动解决</small><strong>{metrics.resolved}</strong><p>低风险问题无需介入</p></article><article><small>决策依据</small><strong>5<sup>条</sup></strong><p>可追溯的售后政策</p></article></section>
        <section className="case-panel" id="cases"><header><div><small>INBOX</small><h3>最新售后工单</h3></div><span>点击工单查看 Agent 结果</span></header><div className="case-list">{cases.map((item) => <button className="case-row" key={item.id} onClick={() => setSelectedId(item.id)}><span className="case-avatar">{item.initials}</span><div><strong>{item.customerName}</strong><small>{item.subject}</small></div><span>{item.channel}</span><b className={item.status === "待人工确认" ? "review" : item.status === "自动解决" ? "resolved" : ""}>{item.status}</b><i>›</i></button>)}</div></section>
      </section>

      {selected && <div className="drawer-backdrop"><aside className="case-drawer" role="dialog" aria-modal="true" aria-label={`${selected.orderNumber} Agent 分析`}>
        <header><div><small>{selected.id}</small><h2>订单 {selected.orderNumber} 异常分析</h2></div><button className="close" onClick={() => setSelectedId(null)} aria-label="关闭">×</button></header>
        <div className="drawer-actions"><button onClick={runAgent} disabled={busy === selected.id}>{busy === selected.id ? "Agent 运行中…" : "重新运行 Agent"}</button><button className="secondary" onClick={copyReply}>复制回复</button></div>
        <section className="decision"><div><strong>{selected.anomalyReason === "等待 Agent 分析" ? "等待分析" : selected.issueType === "customs_delay" ? "海关延误" : selected.issueType === "parcel_returned" ? "包裹退回" : selected.issueType === "delivered_not_received" ? "妥投未收到" : "物流查询"}</strong>{selected.confidence > 0 && <span>{selected.confidence}% 置信度</span>}</div><p>{selected.anomalyReason}</p><footer><span>建议：{selected.recommendation}</span><b>{selected.status}</b></footer></section>
        <section className="drawer-grid"><article><small>订单</small><strong>{selected.orderNumber} · {selected.currency} {(selected.amountCents / 100).toFixed(2)}</strong><p>{selected.customerName}</p></article><article><small>物流</small><strong>{selected.trackingStatus}</strong><p>{selected.channel} · {selected.source}</p></article></section>
        <section className="trace"><h3>Agent 处理流程</h3>{["识别问题场景", "读取演示订单与物流", "确定性匹配售后政策", "执行安全护栏", "生成客户回复草稿"].map((step, index) => <div key={step}><span>✓</span><div><strong>{step}</strong><small>{index === 3 ? "资金动作与高价值订单保持人工确认" : "演示流程节点；完成结果写入审计摘要"}</small></div></div>)}</section>
        <section className="reply"><h3>客户回复草稿</h3><p>{selected.replyDraft || "运行 Agent 后将在这里生成基于事实和政策的回复草稿。"}</p></section>
        <section className="policy" id="policies"><h3>政策依据</h3><div><strong>{selected.policyTitle ?? "等待政策匹配"}{selected.policyCode ? ` · ${selected.policyCode}` : ""}</strong><p>{selected.policyCode ? "政策条款已按问题类型从知识库确定性匹配，并作为本次建议的可追溯依据。" : "运行 Agent 后显示匹配的政策条款。"}</p></div></section>
      </aside></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
