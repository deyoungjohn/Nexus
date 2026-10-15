import type {NextRequest} from 'next/server';
import {reanchorCommand} from '../../../server/reanchor';
import {executionJson} from '../../../../src/execution/execution-json.js';
import {failure,json,mutationBody,sessionToken} from '../../../server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {try {
  const input=await mutationBody(request);
  return json(JSON.parse(executionJson(await reanchorCommand(sessionToken(request),input))));
}catch(error){return failure(error);}}
