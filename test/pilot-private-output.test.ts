import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {privateOutputPath} from '../src/pilot/private-output.js';

test('P5.5 private owner outputs reject repository dot prefixes and parent symlink escapes',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'nexus-private-path-')),project=join(dir,'project');
  try{
    await mkdir(project);await mkdir(join(project,'..owner'));await symlink(project,join(dir,'outside-looking-link'));
    await assert.rejects(()=>privateOutputPath(join(project,'..owner','data.json'),project));
    await assert.rejects(()=>privateOutputPath(join(dir,'outside-looking-link','data.json'),project));
    assert.equal(await privateOutputPath(join(dir,'private-owner.json'),project),join(dir,'private-owner.json'));
    assert.equal(await privateOutputPath('/nexus-private-output.json',project),'/nexus-private-output.json');
  }finally{await rm(dir,{recursive:true,force:true});}
});
