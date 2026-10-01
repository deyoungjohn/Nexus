import type { NextRequest } from "next/server";
import { SESSION_SECONDS } from "../../../../../src/application/session.js";
import { commandObject, configuredOrigin, cookieName, failure, json, mutationBody, workspace } from "../../../../server/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const body = commandObject(await mutationBody(request),["id","signature"]);
    if (typeof body.id !== "string" || typeof body.signature !== "string") return json({ error:"Challenge and signature are required." },400);
    const session = await workspace().sessions.verify(body.id,body.signature,new Date());
    const response = json({ wallet:session.wallet,expiresAt:session.expiresAt });
    response.cookies.set(cookieName(),session.token,{ httpOnly:true,sameSite:"strict",secure:configuredOrigin().startsWith("https:"),path:"/",maxAge:SESSION_SECONDS });
    return response;
  } catch (error) { return failure(error); }
}
