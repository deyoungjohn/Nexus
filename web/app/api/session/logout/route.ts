import type { NextRequest } from "next/server";
import { commandObject, configuredOrigin, cookieName, failure, json, mutationBody, sessionToken, workspace } from "../../../../server/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    commandObject(await mutationBody(request),[]);
    const token = request.cookies.get(cookieName())?.value;
    if (token !== undefined) await workspace().sessions.logout(sessionToken(request),new Date());
    const response = json({ signedOut:true });
    response.cookies.set(cookieName(),"",{ httpOnly:true,sameSite:"strict",secure:configuredOrigin().startsWith("https:"),path:"/",maxAge:0 });
    return response;
  } catch (error) { return failure(error); }
}
