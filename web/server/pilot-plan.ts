import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {requireInput} from '../../src/domain/errors.js';
import type {InstrumentInput} from '../../src/domain/instrument.js';
import type {CoordinatorPolicy} from '../../src/coordinator/plan.js';
import {SessionStore} from '../../src/application/session.js';
import {PilotPlanningService} from '../../src/pilot/planning.js';
import type {PilotAdmissionProfile} from '../../src/pilot/profile.js';
import {createBscSnapshotReader} from '../../src/execution/chain-bootstrap.js';
import {parseRecoveryConfig} from '../../src/execution/recovery-config.js';
import {decodeExecutionJson} from '../../src/execution/execution-json.js';
import {fetchChainlinkBscSettlement} from '../../src/market-gate/chainlink-bsc.js';
import {configuredOrigin,databasePool,commandObject} from './http';

export async function pilotPlanCommand(token:string,input:unknown){
  const c=commandObject(input,['portfolioId','requestId']);
  requireInput(typeof c.portfolioId==='string'&&typeof c.requestId==='string'&&c.requestId.length<=100,
    'INVALID_COMMAND','Portfolio and bounded request ID required.');
  const pool=databasePool(),sessions=new SessionStore(pool,configuredOrigin());
  await sessions.authenticate(token,new Date());
  requireInput(!!process.env.NEXUS_EXECUTION_CONFIG,'EXECUTION_UNCONFIGURED','Configure the owner pilot first.');
  const config=decodeExecutionJson<{deployment:{pilotProfile?:PilotAdmissionProfile;marketPolicy:{maxStatusAgeMs:number}};
    pilotInstrument?:InstrumentInput;pilotCoordinatorPolicy?:CoordinatorPolicy;rpcUrl:string;
    settlementMaxAgeMs:number;settlementUncertaintyBps:number;settlementMaxPegDeviationBps:number}>(
    JSON.parse(await readFile(process.env.NEXUS_EXECUTION_CONFIG!,'utf8')));
  requireInput(config.deployment.pilotProfile!==undefined&&config.pilotInstrument!==undefined&&config.pilotCoordinatorPolicy!==undefined,
    'EXECUTION_UNCONFIGURED','Reviewed pilot profile, instrument and coordinator policy required.');
  const recovery=parseRecoveryConfig(JSON.parse(await readFile(process.env.NEXUS_RECOVERY_CONFIG??'config/bsc-recovery.json','utf8')));
  const service=new PilotPlanningService(pool,sessions,config.deployment.pilotProfile,config.pilotInstrument,config.pilotCoordinatorPolicy,
    createBscSnapshotReader(recovery),now=>fetchChainlinkBscSettlement({rpcUrl:config.rpcUrl,now,
      maxBlockAgeMs:config.deployment.marketPolicy.maxStatusAgeMs,maxReferenceAgeMs:config.settlementMaxAgeMs,
      uncertaintyBps:config.settlementUncertaintyBps,maxPegDeviationBps:config.settlementMaxPegDeviationBps}));
  return service.prepare({sessionToken:token,portfolioId:c.portfolioId,requestId:c.requestId||randomUUID()});
}
