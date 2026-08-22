import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { auditEvents, monitorRuns, policies, supportCases } from "./schema";

export const seedCases = [
  { id: "DEMO-1001", orderNumber: "#1001", customerName: "演示客户", initials: "演", subject: "订单 #1001 巡检预警", channel: "演示店铺", status: "待人工确认", priority: "high", amountCents: 8610, currency: "USD", trackingStatus: "pre_transit", issueType: "tracking_inquiry", anomalyReason: "运单已创建，但暂时没有揽收记录；演示规则将该案例标记为需要人工复核。", recommendation: "核实仓库交接状态并向客户说明，处理动作保持人工确认。", replyDraft: "您好，订单 #1001 已生成运单但暂时没有揽收记录。我们会联系仓库核实，并尽快向您更新。", confidence: 96, policyCode: "P-SHIP-01", policyTitle: "物流时效与停滞判断", source: "fictional-demo" },
  { id: "CASE-1005", orderNumber: "#1005", customerName: "Noah Miller", initials: "NM", subject: "Customs delay", channel: "Website", status: "待处理", priority: "normal", amountCents: 12800, currency: "USD", trackingStatus: "in_transit", issueType: "customs_delay", source: "demo" },
  { id: "CASE-1003", orderNumber: "#1003", customerName: "Olivia Brown", initials: "OB", subject: "Parcel returned", channel: "Email", status: "待处理", priority: "normal", amountCents: 7600, currency: "USD", trackingStatus: "returned", issueType: "parcel_returned", source: "demo" },
  { id: "CASE-1004", orderNumber: "#1004", customerName: "Lucas Martin", initials: "LM", subject: "Delivered but not received", channel: "Email", status: "待处理", priority: "normal", amountCents: 21200, currency: "USD", trackingStatus: "delivered", issueType: "delivered_not_received", source: "demo" },
  { id: "CASE-1006", orderNumber: "#1006", customerName: "王琳", initials: "王", subject: "查询物流进度", channel: "站内聊天", status: "待处理", priority: "low", amountCents: 4900, currency: "USD", trackingStatus: "in_transit", issueType: "tracking_inquiry", source: "demo" },
];

const seedPolicies = [
  { code: "P-SHIP-01", title: "物流时效与停滞判断", content: "超过承诺送达日 3 天视为延误；连续 7 天没有物流更新视为严重异常并发起调查。" },
  { code: "P-REFUND-02", title: "退款与补发安全护栏", content: "退款、补发以及高价值订单必须由人工确认，Agent 只能生成建议和客户回复草稿。" },
  { code: "P-CUSTOMS-03", title: "海关延误沟通规范", content: "说明清关属于跨境运输环节，不承诺未经承运商确认的具体到货时间。" },
  { code: "P-DNR-04", title: "妥投未收到处理流程", content: "先核对地址、门卫和邻居，再向承运商发起查件；补发或退款由人工审批。" },
  { code: "P-RETURN-05", title: "包裹退回处理流程", content: "确认退回原因和库存后提供重寄或退款方案，任何资金动作需要人工确认。" },
];

export async function ensureSeedData() {
  const db = getDb();
  await db.insert(policies).values(seedPolicies).onConflictDoNothing();
  await db.insert(supportCases).values(seedCases).onConflictDoNothing();
  return db;
}

export async function getDashboardData() {
  const db = await ensureSeedData();
  const [cases, latestRun, policyCount] = await Promise.all([
    db.select().from(supportCases).orderBy(desc(supportCases.updatedAt)),
    db.select().from(monitorRuns).orderBy(desc(monitorRuns.createdAt)).limit(1),
    db.select({ count: sql<number>`count(*)` }).from(policies),
  ]);
  return { cases, latestRun: latestRun[0] ?? null, policyCount: Number(policyCount[0]?.count ?? 0) };
}

export async function runMonitor(actorId = "system") {
  const db = await ensureSeedData();
  const cases = await db.select().from(supportCases);
  const alerted = cases.filter((item) => item.priority === "high").length;
  await db.insert(monitorRuns).values({ scanned: cases.length, analyzed: cases.length, alerted });
  await db.insert(auditEvents).values({ actorId, action: "monitor.completed", detail: `巡检 ${cases.length} 个订单，发现 ${alerted} 个需要关注的异常。` });
  return { scanned: cases.length, analyzed: cases.length, alerted };
}

export async function runCaseAgent(caseId: string, actorId = "system") {
  const db = await ensureSeedData();
  const [item] = await db.select().from(supportCases).where(eq(supportCases.id, caseId)).limit(1);
  if (!item) return null;
  const decisions: Record<string, { reason: string; recommendation: string; reply: string; confidence: number; policyCode: string; policyTitle: string; status: string }> = {
    customs_delay: { reason: "物流仍在运输中，当前节点显示海关处理时间超过常规区间。", recommendation: "向承运商查询清关状态，并向客户提供不含虚假时效承诺的进度说明。", reply: `您好，订单 ${item.orderNumber} 当前处于海关处理阶段。我们已准备向承运商查询进度，有更新会第一时间通知您。`, confidence: 91, policyCode: "P-CUSTOMS-03", policyTitle: "海关延误沟通规范", status: "处理中" },
    parcel_returned: { reason: "物流状态显示包裹已进入退回流程，需要确认退回原因和库存。", recommendation: "核实退回原因后提供重寄或退款选项，任何资金动作转人工确认。", reply: `您好，订单 ${item.orderNumber} 的包裹正在退回。我们正在核实原因，确认后会为您提供重寄或退款方案。`, confidence: 94, policyCode: "P-RETURN-05", policyTitle: "包裹退回处理流程", status: "待人工确认" },
    delivered_not_received: { reason: "承运商标记已妥投，但客户反馈未收到，需要执行妥投未收到核查。", recommendation: "先核对地址、门卫和邻居，再向承运商发起查件；补发或退款转人工。", reply: `您好，我们看到订单 ${item.orderNumber} 已被标记为妥投。请先帮忙确认收货地址、门卫或邻居，我们也会同步准备向承运商查件。`, confidence: 93, policyCode: "P-DNR-04", policyTitle: "妥投未收到处理流程", status: "处理中" },
    tracking_inquiry: { reason: item.priority === "high" ? item.anomalyReason : "订单物流仍在正常运输窗口内，暂未发现严重停滞。", recommendation: item.priority === "high" ? item.recommendation : "向客户同步当前物流节点并持续监控，暂不需要人工介入。", reply: item.priority === "high" ? item.replyDraft : `您好，订单 ${item.orderNumber} 仍在运输中，目前没有发现严重异常。我们会继续监控物流进度。`, confidence: item.priority === "high" ? 96 : 89, policyCode: "P-SHIP-01", policyTitle: "物流时效与停滞判断", status: item.priority === "high" ? "待人工确认" : "自动解决" },
  };
  const decision = decisions[item.issueType] ?? decisions.tracking_inquiry;
  const now = new Date().toISOString();
  await db.update(supportCases).set({ anomalyReason: decision.reason, recommendation: decision.recommendation, replyDraft: decision.reply, confidence: decision.confidence, policyCode: decision.policyCode, policyTitle: decision.policyTitle, status: decision.status, updatedAt: now }).where(eq(supportCases.id, caseId));
  await db.insert(auditEvents).values({ caseId, actorId, action: "agent.analysis_completed", detail: `依据 ${decision.policyCode} 生成建议；置信度 ${decision.confidence}%。` });
  return { ...item, anomalyReason: decision.reason, recommendation: decision.recommendation, replyDraft: decision.reply, confidence: decision.confidence, policyCode: decision.policyCode, policyTitle: decision.policyTitle, status: decision.status, updatedAt: now };
}
