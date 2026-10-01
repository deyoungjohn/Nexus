import { readFile } from "node:fs/promises";
import { ExecutionApplication } from "../../src/application/execution.js";
import { SessionStore } from "../../src/application/session.js";
import { createBStocksExecutionRuntime } from "../../src/execution/bstocks-runtime.js";
import { decodeExecutionJson } from "../../src/execution/execution-json.js";
import { parseRecoveryConfig } from "../../src/execution/recovery-config.js";
import { parseTokenSecurityReviews } from "../../src/security/token-security.js";
import type { BStocksProductionReviewPorts } from "../../src/market-gate/bstocks-production.js";
import { configuredOrigin, databasePool } from "./http";

// Qualified access/economic/events/valuations need server integrations. Missing is blocking.
export const unresolvedProductionSources:Omit<BStocksProductionReviewPorts,"quote"|"simulation">={
  accessPolicy:null,reviewedControl:null,access:{async session(){return {active:false,binding:null};},async jurisdiction(){return null;},
    async country(){return null;},async product(){return null;}},
  async economicQuantity(){return null;},async portfolioValuations(){return null;},
  async event(){return null;},async providerEvent(){return null;}
};
export async function executionApplication():Promise<ExecutionApplication>{
  const pool=databasePool(),sessions=new SessionStore(pool,configuredOrigin());
  const file=process.env.NEXUS_EXECUTION_CONFIG;
  if(!file)return new ExecutionApplication(pool,sessions,null);
  // Operator filesystem only. Reload per request so deployment changes invalidate old reviews.
  const config=decodeExecutionJson<Omit<Parameters<typeof createBStocksExecutionRuntime>[0],"pool"|"sessions"|"recoveryConfig"|"securityReviews">>(
    JSON.parse(await readFile(file,"utf8")));
  const [recovery,reviews]=await Promise.all([
    readFile(process.env.NEXUS_RECOVERY_CONFIG??"config/bsc-recovery.json","utf8"),
    readFile(process.env.NEXUS_TOKEN_SECURITY_REVIEWS??"config/token-security-reviews.json","utf8")]);
  const executor=createBStocksExecutionRuntime({...config,pool,sessions,
    recoveryConfig:parseRecoveryConfig(JSON.parse(recovery)),securityReviews:parseTokenSecurityReviews(JSON.parse(reviews))},unresolvedProductionSources);
  return new ExecutionApplication(pool,sessions,executor,config.deployment.broadcastEnabled??false);
}
