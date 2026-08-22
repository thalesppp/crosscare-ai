export async function GET() {
  return Response.json({
    ok: true,
    service: "crosscare-ai",
    mode: "public-demo",
    checkedAt: new Date().toISOString(),
  });
}
