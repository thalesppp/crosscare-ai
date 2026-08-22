import { getChatGPTUser } from "@/app/chatgpt-auth";
import { guardPublicMutation } from "@/app/api/mutation-guard";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rejection = await guardPublicMutation(request, {
    scope: "case-agent.run",
    limit: 18,
  });
  if (rejection) return rejection;

  try {
    const { runCaseAgent } = await import("@/db/repository");
    const [{ id }, user] = await Promise.all([context.params, getChatGPTUser()]);
    const result = await runCaseAgent(id, user?.userId ?? "local-preview");
    if (!result) return Response.json({ error: "工单不存在" }, { status: 404 });
    return Response.json({ case: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent 运行失败";
    return Response.json({ error: message }, { status: 503 });
  }
}
