import { getChatGPTUser } from "@/app/chatgpt-auth";
import { guardPublicMutation } from "@/app/api/mutation-guard";

export async function POST(request: Request) {
  const rejection = await guardPublicMutation(request, {
    scope: "monitor.run",
    limit: 6,
  });
  if (rejection) return rejection;

  try {
    const { runMonitor } = await import("@/db/repository");
    const user = await getChatGPTUser();
    return Response.json(await runMonitor(user?.userId ?? "local-preview"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "巡检运行失败";
    return Response.json({ error: message }, { status: 503 });
  }
}
