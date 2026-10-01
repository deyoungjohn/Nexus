import type { NextRequest } from "next/server";
import { commandObject, failure, json, mutationBody, workspace } from "../../../../server/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const body = commandObject(await mutationBody(request),["wallet"]);
    if (typeof body.wallet !== "string") return json({ error:"A wallet address is required." },400);
    return json(await workspace().sessions.challenge(body.wallet,new Date()));
  } catch (error) { return failure(error); }
}
