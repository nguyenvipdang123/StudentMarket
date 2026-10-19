import {spawn} from 'node:child_process';
import {cp,access,readdir,unlink,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const nextEnv=await readFile('next-env.d.ts').catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{
  env:{...process.env,STUDENTMARKET_STANDALONE:'1',NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit',windowsHide:true,
});
const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
if(nextEnv)await writeFile('next-env.d.ts',nextEnv);else await unlink('next-env.d.ts').catch(e=>{if(e.code!=='ENOENT')throw e;});
if(code!==0)process.exit(typeof code==='number'?code:1);
await access('.next-render/standalone/server.js');
await cp('public','.next-render/standalone/public',{recursive:true});
await cp('.next-render/static','.next-render/standalone/.next-render/static',{recursive:true});
// A local build may trace dotenv files; runtime configuration always comes from the server environment.
for(const entry of await readdir('.next-render/standalone',{withFileTypes:true})) {
  if(entry.isFile() && entry.name.startsWith('.env'))await unlink('.next-render/standalone/'+entry.name);
}
console.log('Production standalone build ready (including fonts, images and CSS).');
