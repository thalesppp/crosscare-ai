import { getDashboardData } from "@/db/repository";

export async function GET() {
  try {
    return Response.json(await getDashboardData());
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据库暂时不可用";
    return Response.json({ error: message }, { status: 503 });
  }
}
