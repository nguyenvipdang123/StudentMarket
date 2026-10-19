import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve,join } from "node:path";
import { connect } from "node:net";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const nextCli=join(root,"frontend/node_modules/next/dist/bin/next");
if(process.argv[2]!=="chat"&&!existsSync(nextCli)){
  console.error("Thiếu dependencies frontend. Chạy: npm --prefix frontend ci, sau đó chạy lại npm run dev.");
  process.exit(1);
}
const python=join(root,process.platform==="win32"?".venv/Scripts/python.exe":".venv/bin/python");
if(!existsSync(python)){console.error("Create .venv and install fastapi_chat/requirements.txt; see README.md.");process.exit(1);}
const children=[];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code;}
function start(command,args,cwd,optional=false){
  const child=spawn(command,args,{cwd,stdio:"inherit",windowsHide:true,env:process.env});
  children.push(child);
  child.on("error",e=>{console.error(e.message);if(!optional)stop(1);});
  child.on("exit",code=>{if(!stopping){if(optional){if(code)console.error("AI worker stopped; check its log and restart with npm run worker:ai.");}else stop(code||0);}});
}
function listening(port){return new Promise(resolve=>{const socket=connect({host:"127.0.0.1",port});socket.setTimeout(500);socket.once("connect",()=>{socket.destroy();resolve(true);});socket.once("error",()=>{socket.destroy();resolve(false);});socket.once("timeout",()=>{socket.destroy();resolve(false);});});}
if(process.argv[2]!=="chat"&&!(await listening(3000)))start(process.execPath,[nextCli,"dev","--webpack"],join(root,"frontend"));
if(process.argv[2]!=="chat")start(process.execPath,["--experimental-strip-types",join(root,"frontend/scripts/ai-moderation-worker.mjs")],join(root,"frontend"),true);
const pdfChatRoot=resolve(root,"../ai-pdf-chatbot-langchain");
const pdfChatRunner=join(pdfChatRoot,"scripts/dev-local.mjs");
if(process.argv[2]!=="chat"&&existsSync(pdfChatRunner))start(process.execPath,[pdfChatRunner],pdfChatRoot);
if(!(await listening(8000)))start(python,["-m","uvicorn","fastapi_chat.main:app","--host","127.0.0.1","--port","8000","--ws-max-size","20000","--no-access-log","--log-level","warning"],root);
console.log("StudentMarket: http://localhost:3000 | Chat: http://127.0.0.1:8000/health");
process.on("SIGINT",()=>stop());
process.on("SIGTERM",()=>stop());

