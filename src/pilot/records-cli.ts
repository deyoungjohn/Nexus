import {readFile,writeFile} from 'node:fs/promises';
import {requireInput,DomainError} from '../domain/errors.js';
import {decodeExecutionJson,executionJson} from '../execution/execution-json.js';
import {pilotDeclarationTypedData,validatePilotManualRecords,type PilotManualRecords} from './manual-records.js';
import type {PilotAdmissionProfile} from './profile.js';
import {privateOutputPath} from './private-output.js';

/** Export typed data for an owner's hardware/local signer; no signing or network submission. */
async function main(){
  const args=process.argv.slice(2);
  requireInput(args.length===2&&args[0]==='--output'&&!!process.env.NEXUS_EXECUTION_CONFIG&&!!process.env.NEXUS_PILOT_RECORDS,
    'INVALID_ARGUMENTS','Set private config/records paths and use --output <private typed-data file>.');
  const output=await privateOutputPath(args[1]!);
  const config=decodeExecutionJson<{deployment:{pilotProfile:PilotAdmissionProfile}}>(JSON.parse(
    await readFile(process.env.NEXUS_EXECUTION_CONFIG!,'utf8')));
  const records=decodeExecutionJson<PilotManualRecords>(JSON.parse(await readFile(process.env.NEXUS_PILOT_RECORDS!,'utf8')));
  validatePilotManualRecords(config.deployment.pilotProfile,records);
  const {declaration,...rest}=records,{signature:_signature,...unsigned}=declaration;
  const typed=pilotDeclarationTypedData(config.deployment.pilotProfile,rest,unsigned);
  await writeFile(output,executionJson({domain:typed.domain,types:{EIP712Domain:[{name:'name',type:'string'},
    {name:'version',type:'string'},{name:'chainId',type:'uint256'}],...typed.types},primaryType:'PilotEligibility',message:typed.value})+'\n',
    {mode:0o600,flag:'wx'});
  process.stdout.write('Private eligibility typed data exported. Review all bound records before signing. No transaction sent.\n');
}
main().catch(error=>{process.stderr.write(`${error instanceof DomainError?error.code:'PILOT_RECORD_EXPORT_FAILED'}\n`);process.exitCode=1;});
