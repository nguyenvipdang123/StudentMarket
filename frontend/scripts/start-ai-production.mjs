import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {productionErrors} from './production-config.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const missing=productionErrors(process.env,'worker');
if(missing.length){console.error('Worker configuration required: '+missing.join(', '));process.exit(1);}
const child=spawn(process.execPath,['--experimental-strip-types','scripts/ai-moderation-worker.mjs'],{stdio:'inherit',windowsHide:true,env:{...process.env,NODE_ENV:'production'}});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('error',()=>{console.error('AI worker could not start.');process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});
