import type { NextRequest } from 'next/server';
import { chainSnapshotCommand,pilotAvailability } from '../../../server/chain-snapshot';
import { executionJson } from '../../../../src/execution/execution-json.js';
import { failure,json,mutationBody,sessionToken } from '../../../server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){try{
  const portfolio=request.nextUrl.searchParams.get('portfolio');
  if(!portfolio)return json({error:'Portfolio ID required.',code:'INVALID_COMMAND'},400);
  return json(await pilotAvailability(sessionToken(request),portfolio));
}catch(error){return failure(error);}}
export async function POST(request:NextRequest){try{
  const body=await mutationBody(request);
  return json(JSON.parse(executionJson(await chainSnapshotCommand(sessionToken(request),body))));
}catch(error){return failure(error);}}
