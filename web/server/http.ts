import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { DomainError, requireInput } from "../../src/domain/errors.js";
import { appOrigin, requireOrigin } from "../../src/application/session.js";
import { commandObject, WorkspaceService } from "../../src/application/workspace.js";

const runtime = globalThis as typeof globalThis & { nexusPool?: Pool };
export function configuredOrigin(): string { return appOrigin(process.env.NEXUS_APP_ORIGIN ?? "http://localhost:3000"); }
export function databasePool(): Pool {
  configuredOrigin();
  requireInput(Boolean(process.env.DATABASE_URL),"WORKSPACE_UNAVAILABLE","Saved workspace is unavailable. Configure and migrate its PostgreSQL database.");
  runtime.nexusPool ??= new Pool({ connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:5000 });
  return runtime.nexusPool;
}
export function workspace(): WorkspaceService { return new WorkspaceService(databasePool(),configuredOrigin()); }
export const cookieName = () => configuredOrigin().startsWith("https:") ? "__Host-nexus_session" : "nexus_session";
export function sessionToken(request: NextRequest): string {
  const value = request.cookies.get(cookieName())?.value;
  requireInput(value !== undefined,"SESSION_REQUIRED","Sign in to open saved records.");
  return value;
}
export async function mutationBody(request: NextRequest): Promise<unknown> {
  requireOrigin(request.headers.get("origin"),configuredOrigin());
  requireInput(request.headers.get("content-type")?.split(";",1)[0]?.trim() === "application/json","INVALID_COMMAND","Send a JSON command.");
  const reader = request.body?.getReader();
  requireInput(reader !== undefined,"INVALID_COMMAND","A JSON body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      requireInput(size <= 16_384,"BODY_TOO_LARGE","Command exceeds the 16 KiB limit.");
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new DomainError("INVALID_COMMAND","The command must be valid JSON."); }
  return body;
}
export function json(value: unknown, status = 200): NextResponse {
  return NextResponse.json(value,{ status,headers:{ "Cache-Control":"no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff" } });
}
export function failure(error: unknown): NextResponse {
  if (!(error instanceof DomainError)) return json({ code:"WORKSPACE_UNAVAILABLE",error:"Saved workspace is unavailable. Check its database configuration and migrations." },503);
  const status = error.code === "SESSION_REQUIRED" ? 401 : error.code === "WRONG_ORIGIN" ? 403
    : error.code === "PORTFOLIO_UNAVAILABLE" ? 404 : error.code === "SIGN_IN_RATE_LIMIT" ? 429
    : error.code === "BODY_TOO_LARGE" ? 413 : ["WORKSPACE_UNAVAILABLE","EXECUTION_UNCONFIGURED","INVALID_APP_ORIGIN","EVENT_SOURCE_UNAVAILABLE"].includes(error.code) ? 503
    : ["APPROVAL_EXPIRED","EXECUTION_CONTEXT_CHANGED","MARKET_GATE_BLOCKED","MARKET_EVIDENCE_CHANGED","CHAIN_STATE_CHANGED","BROADCAST_DISABLED","STALE_REVISION","UNRESOLVED_SUBMISSION","RULE_VERSION_CONFLICT","RULE_NOT_REVIEWED"].includes(error.code) ? 409 : 400;
  return json({ code:error.code,error:error.message },status);
}
export { commandObject };
