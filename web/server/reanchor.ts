import {readFile} from 'node:fs/promises';
import {requireInput} from '../../src/domain/errors.js';
import {SessionStore} from '../../src/application/session.js';
import {ReanchorService} from '../../src/execution/reanchor.js';
import {createBscReanchorReader} from '../../src/execution/reanchor-evidence.js';
import {parseRecoveryConfig} from '../../src/execution/recovery-config.js';
import {databasePool,configuredOrigin,commandObject} from './http';

export async function reanchorCommand(token:string,input:unknown) {
  const kind=(input as Record<string,unknown>|null)?.kind;
  const c=commandObject(input,kind==='prepare'?['kind','portfolioId','legId']:kind==='activate'?['kind','reviewId','ownerSignature']:[]);
  requireInput(kind==='prepare'||kind==='activate','INVALID_COMMAND','Unknown recovery transition.');
  const pool=databasePool(),sessions=new SessionStore(pool,configuredOrigin());
  await sessions.authenticate(token,new Date());
  const config=parseRecoveryConfig(JSON.parse(await readFile(process.env.NEXUS_RECOVERY_CONFIG??'config/bsc-recovery.json','utf8')));
  const service=new ReanchorService(pool,sessions,config,createBscReanchorReader(config));
  if(kind==='activate') {
    requireInput(typeof c.reviewId==='string'&&typeof c.ownerSignature==='string'&&/^0x[0-9a-f]{130}$/i.test(c.ownerSignature),
      'INVALID_COMMAND','Exact review and owner signature required.');
    return service.activate({sessionToken:token,reviewId:c.reviewId,ownerSignature:c.ownerSignature});
  }
  requireInput(typeof c.portfolioId==='string'&&typeof c.legId==='string','INVALID_COMMAND','Portfolio and disputed leg required.');
  const review=await service.prepare({sessionToken:token,portfolioId:c.portfolioId,legId:c.legId});
  const {typedData,...rest}=review;
  return{...rest,typedData:{domain:typedData.domain,primaryType:'Reanchor',types:{...typedData.types,EIP712Domain:[
    {name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'}]},message:typedData.value}};
}
