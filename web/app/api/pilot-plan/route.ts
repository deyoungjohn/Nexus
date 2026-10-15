import type {NextRequest} from 'next/server';
import {pilotPlanCommand} from '../../../server/pilot-plan';
import {failure,json,mutationBody,sessionToken} from '../../../server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){try{
  const body=await mutationBody(request);
  return json(await pilotPlanCommand(sessionToken(request),body));
}catch(error){return failure(error);}}
