import {realpath,access} from 'node:fs/promises';
import {dirname,basename,resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {requireInput} from '../domain/errors.js';

async function projectRoot():Promise<string>{
  let dir=dirname(fileURLToPath(import.meta.url));
  for(;;){try{await access(resolve(dir,'package.json'));return realpath(dir);}catch{/* Walk out of src/dist. */}
    const parent=dirname(dir);if(parent===dir)throw Error('Project root unavailable');dir=parent;}
}

/** Resolve existing parent symlinks and reject dot-prefix tricks before writing owner records. */
export async function privateOutputPath(path:string,root?:string):Promise<string>{
  const target=resolve(path),parent=await realpath(dirname(target)),project=await realpath(root??await projectRoot());
  const actual=resolve(parent,basename(target)),delta=relative(project,actual);
  requireInput(isAbsolute(delta)||delta==='..'||delta.startsWith(`..${sep}`),'PRIVATE_OUTPUT_REQUIRED',
    'Owner records must be outside the project directory, including through symlinks.');
  return actual;
}

/** Validate a not-yet-created private directory before mkdir can affect the repository. */
export async function privateOutputDirectory(path:string):Promise<string>{
  const target=resolve(path),project=await projectRoot();
  const delta=relative(project,target);
  requireInput(isAbsolute(delta)||delta==='..'||delta.startsWith(`..${sep}`),'PRIVATE_OUTPUT_REQUIRED',
    'Owner evidence directories must be outside the project.');
  let existing=target;
  for(;;){
    try{const actual=await realpath(existing);
      requireInput(actual===existing,'PRIVATE_OUTPUT_REQUIRED','Private directories must not traverse symlinks.');break;}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
      const parent=dirname(existing);if(parent===existing)throw error;existing=parent;}
  }
  return target;
}
