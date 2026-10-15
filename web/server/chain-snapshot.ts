import { readFile } from 'node:fs/promises';
import { requireInput } from '../../src/domain/errors.js';
import { SessionStore } from '../../src/application/session.js';
import { ChainBootstrapService, createBscSnapshotReader } from '../../src/execution/chain-bootstrap.js';
import { parseRecoveryConfig } from '../../src/execution/recovery-config.js';
import { decodeExecutionJson } from '../../src/execution/execution-json.js';
import { validatePilotProfile, type PilotAdmissionProfile } from '../../src/pilot/profile.js';
import { configuredOrigin, databasePool, commandObject } from './http';

export async function pilotAvailability(token:string,portfolioId:string){
  const pool=databasePool(),session=await new SessionStore(pool,configuredOrigin()).authenticate(token,new Date());
  const owned=await pool.query('SELECT 1 FROM portfolios WHERE id=$1 AND owner_wallet=$2',[portfolioId,session.wallet]);
  requireInput(owned.rowCount===1,'PORTFOLIO_UNAVAILABLE','Owned portfolio required.');
  if(!process.env.NEXUS_EXECUTION_CONFIG)return{configured:false,maximumSpendUnits:null};
  const config=decodeExecutionJson<{deployment:{pilotProfile?:PilotAdmissionProfile}}>(
    JSON.parse(await readFile(process.env.NEXUS_EXECUTION_CONFIG,'utf8')));
  const profile=config.deployment.pilotProfile;
  if(!profile||profile.wallet!==session.wallet)return{configured:false,maximumSpendUnits:null};
  validatePilotProfile(profile);return{configured:true,maximumSpendUnits:profile.maximumSpendRaw.toString()};
}

export async function chainSnapshotCommand(token:string,input:unknown){
  const kind=(input as Record<string,unknown>|null)?.kind;
  const fields=kind==='bootstrap'||kind==='resync'?['kind','portfolioId','reason']
    :kind==='activate'?['kind','reviewId','ownerSignature']:[];
  requireInput(fields.length>0,'INVALID_COMMAND','Unknown chain snapshot command.');
  const c=commandObject(input,fields),sessions=new SessionStore(databasePool(),configuredOrigin());
  const session=await sessions.authenticate(token,new Date());
  requireInput(!!process.env.NEXUS_EXECUTION_CONFIG,'EXECUTION_UNCONFIGURED','Configure the operator pilot profile first.');
  const config=decodeExecutionJson<{deployment:{pilotProfile?:PilotAdmissionProfile}}>(
    JSON.parse(await readFile(process.env.NEXUS_EXECUTION_CONFIG!,'utf8')));
  requireInput(config.deployment.pilotProfile!==undefined,'EXECUTION_UNCONFIGURED','An owner-only pilot profile is required.');
  validatePilotProfile(config.deployment.pilotProfile);
  requireInput(session.wallet.toLowerCase()===config.deployment.pilotProfile.wallet,'PORTFOLIO_UNAVAILABLE','This pilot is unavailable to your wallet.');
  const recovery=parseRecoveryConfig(JSON.parse(await readFile(process.env.NEXUS_RECOVERY_CONFIG??'config/bsc-recovery.json','utf8')));
  const service=new ChainBootstrapService(databasePool(),sessions,recovery,createBscSnapshotReader(recovery));
  if(kind==='activate'){
    requireInput(typeof c.reviewId==='string'&&typeof c.ownerSignature==='string'&&/^0x[0-9a-f]{130}$/i.test(c.ownerSignature),
      'INVALID_COMMAND','Exact stored review and owner signature required.');
    return service.activate({sessionToken:token,reviewId:c.reviewId,ownerSignature:c.ownerSignature});
  }
  requireInput(typeof c.portfolioId==='string'&&typeof c.reason==='string','INVALID_COMMAND','Portfolio and diagnosis required.');
  const review=await service.prepare({sessionToken:token,portfolioId:c.portfolioId,kind:kind as 'bootstrap'|'resync',reason:c.reason});
  const {typedData,...rest}=review;
  return{...rest,typedData:{domain:typedData.domain,primaryType:'ChainSnapshot',types:{...typedData.types,EIP712Domain:[
    {name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'}]},message:typedData.value}};
}
