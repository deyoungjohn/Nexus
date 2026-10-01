import type { NextRequest } from "next/server";
import { failure, json, mutationBody, sessionToken, workspace } from "../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try { return json(await workspace().read(sessionToken(request),new Date(),request.nextUrl.searchParams.get("portfolio") ?? undefined)); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await mutationBody(request);
    return json(await workspace().command(sessionToken(request),new Date(),body));
  } catch (error) { return failure(error); }
}
