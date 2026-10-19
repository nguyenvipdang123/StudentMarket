import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {productionErrors} from './production-config.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const missing=productionErrors();
if(missing.length){console.error('Production configuration required: '+missing.join(', '));process.exit(1);}
const child=spawn(process.execPath,['.next-render/standalone/server.js'],{stdio:'inherit',windowsHide:true,env:{...process.env,NODE_ENV:'production',HOSTNAME:'0.0.0.0',PORT:process.env.PORT||'3000'}});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('error',()=>{console.error('Production server could not start. Run npm run build:render first.');process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});
