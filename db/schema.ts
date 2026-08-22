import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const supportCases = sqliteTable(
  "support_cases",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    initials: text("initials").notNull(),
    subject: text("subject").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("待处理"),
    priority: text("priority").notNull().default("normal"),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    trackingStatus: text("tracking_status").notNull().default("unknown"),
    issueType: text("issue_type").notNull(),
    anomalyReason: text("anomaly_reason").notNull().default("等待 Agent 分析"),
    recommendation: text("recommendation").notNull().default("运行 Agent 生成处理建议"),
    replyDraft: text("reply_draft").notNull().default(""),
    confidence: integer("confidence").notNull().default(0),
    policyCode: text("policy_code"),
    policyTitle: text("policy_title"),
    source: text("source").notNull().default("demo"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("support_cases_status_idx").on(table.status),
    index("support_cases_updated_at_idx").on(table.updatedAt),
  ],
);

export const policies = sqliteTable("policies", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const monitorRuns = sqliteTable(
  "monitor_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scanned: integer("scanned").notNull(),
    analyzed: integer("analyzed").notNull(),
    alerted: integer("alerted").notNull(),
    status: text("status").notNull().default("completed"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("monitor_runs_created_at_idx").on(table.createdAt)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    caseId: text("case_id"),
    actorId: text("actor_id").notNull().default("system"),
    action: text("action").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_events_case_id_idx").on(table.caseId),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

export const mutationRateLimits = sqliteTable(
  "mutation_rate_limits",
  {
    clientKey: text("client_key").notNull(),
    scope: text("scope").notNull(),
    windowStart: integer("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(1),
  },
  (table) => [
    primaryKey({
      columns: [table.clientKey, table.scope, table.windowStart],
      name: "mutation_rate_limits_bucket_pk",
    }),
    index("mutation_rate_limits_window_start_idx").on(table.windowStart),
  ],
);
