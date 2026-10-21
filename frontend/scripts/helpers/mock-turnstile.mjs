import {createServer} from 'node:http';

// Used exclusively by the isolated E2E runner via a fetch preload, never by app code.
export async function startMockTurnstile() {
  const consumed=new Set();
  const server=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    const {secret,response:token}=JSON.parse(raw);
    res.setHeader('Content-Type','application/json');
    if(token==='provider-down'){res.writeHead(503);res.end('{}');return;}
    if(secret!=='e2e-turnstile-secret'){res.end(JSON.stringify({success:false,'error-codes':['invalid-input-secret']}));return;}
    if(typeof token!=='string'||!/^e2e:(register|reset_password|resend_verification|support_create):.+/.test(token)||consumed.has(token)){
      res.end(JSON.stringify({success:false,'error-codes':['timeout-or-duplicate']}));return;
    }
    consumed.add(token);
    res.end(JSON.stringify({success:true,hostname:token.endsWith(':wrong-host')?'evil.invalid':'127.0.0.1',action:token.split(':')[1]}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
