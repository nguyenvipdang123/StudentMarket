"use client";

import {useCallback,useEffect,useRef,useState} from 'react';
import type {TurnstileAction} from '@/lib/turnstile';
import styles from './TurnstileChallenge.module.css';

type TurnstileAPI = {
  render: (container:HTMLElement,options:Record<string,unknown>)=>string;
  remove: (id:string)=>void;
};
declare global { interface Window { turnstile?: TurnstileAPI } }
const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';
let scriptPromise: Promise<TurnstileAPI> | undefined;
function loadScript(): Promise<TurnstileAPI> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileAPI>((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
    const fail=()=>{clearTimeout(timer);script.onload=null;script.onerror=null;script.remove();reject(new Error('Turnstile unavailable'));};
    const timer=window.setTimeout(fail,15000);
    script.onerror=fail;
    script.onload=()=>{if(!window.turnstile){fail();return;}clearTimeout(timer);resolve(window.turnstile);};
    document.head.appendChild(script);
  }).catch(error=>{scriptPromise=undefined;throw error;});
  return scriptPromise;
}

export function useTurnstile(action:TurnstileAction) {
  const [token,setToken]=useState('');
  const [revision,setRevision]=useState(0);
  const reset=useCallback(()=>{setToken('');setRevision(value=>value+1);},[]);
  return {token,ready:!sitekey||Boolean(token),reset,
    widget:<TurnstileChallenge key={`${action}-${revision}`} action={action} onToken={setToken}/>};
}

function TurnstileChallenge({action,onToken}:{action:TurnstileAction;onToken:(token:string)=>void}) {
  const container=useRef<HTMLDivElement>(null);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!sitekey)return;
    let active=true,id:string|undefined,api:TurnstileAPI|undefined;
    const clear=()=>{if(active){onToken('');setState('error');}};
    void loadScript().then(instance=>{
      if(!active||!container.current)return;api=instance;
      id=api.render(container.current,{sitekey,action,theme:'light',size:'flexible',language:'vi',
        'response-field':false,
        callback:(token:string)=>{if(active){onToken(token);setState('ready');}},
        'expired-callback':clear,'error-callback':()=>{clear();return true;},'timeout-callback':clear,
      });
    }).catch(clear);
    return()=>{active=false;if(id!==undefined)api?.remove(id);};
  },[action,onToken,attempt]);
  if(!sitekey)return null;
  return <div className={styles.challenge} aria-label="Xác minh chống bot">
    <div ref={container}/>
    <p role="status" className={styles.status}>{state==='ready'?'Đã xác minh chống bot.':state==='error'?'Xác minh chưa thành công hoặc đã hết hạn. Nội dung bạn nhập vẫn được giữ.':'Đang tải xác minh chống bot…'}</p>
    {state!=='ready'&&<button className={styles.retry} type="button" onClick={()=>{onToken('');setState('loading');setAttempt(value=>value+1);}}>Thử lại xác minh</button>}
  </div>;
}
