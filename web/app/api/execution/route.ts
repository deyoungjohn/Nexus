import type { NextRequest } from "next/server";
import { executionApplication } from "../../../server/execution";
import { failure, json, mutationBody, sessionToken } from "../../../server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){try{
  const token=sessionToken(request),portfolio=request.nextUrl.searchParams.get("portfolio");
  if(!portfolio)return json({code:"INVALID_COMMAND",error:"Portfolio ID required."},400);
  return json(await(await executionApplication()).read(token,new Date(),portfolio));
}catch(error){return failure(error);}}
export async function POST(request:NextRequest){try{
  const body=await mutationBody(request),token=sessionToken(request);
  return json(await(await executionApplication()).command(token,new Date(),body));
}catch(error){return failure(error);}}
