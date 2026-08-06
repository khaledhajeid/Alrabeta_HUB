import { checkHealth } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await checkHealth());
}
