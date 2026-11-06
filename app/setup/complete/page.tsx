'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Command,LoaderCircle,ShieldCheck} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
export default function CompleteSetupPage(){
 const router=useRouter();const [message,setMessage]=useState('Finishing your school workspace…');const [error,setError]=useState('');
 useEffect(()=>{let alive=true;async function run(){
  const school=new URLSearchParams(window.location.search).get('school')||'';
  const supabase=createClient();const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError){if(alive)setError(userError.message);return;}
  if(!user){if(alive)setMessage('Your email is confirmed. Sign in to finish setting up your school.');return;}
  if(!school){if(alive)setError('The school name is missing from the confirmation link. Return to setup and try again.');return;}
  const {error:setupError}=await supabase.rpc('bootstrap_first_school',{p_school_name:school});
  if(setupError){if(alive)setError(setupError.message);return;}
  if(alive){router.replace('/app');router.refresh();}
 }run();return()=>{alive=false};},[router]);
 return <main className="auth-page"><section className="auth-card"><div className="auth-logo"><span className="brand-mark"><Command size={18}/></span><b>pilot<span className="dot">.</span></b></div>{error?<><h1>Setup needs attention.</h1><div className="auth-error">{error}</div><Link className="auth-submit link-submit" href="/setup">Return to setup</Link></>:<><div className="setup-spinner"><LoaderCircle size={28}/></div><h1>Almost there.</h1><p className="auth-intro">{message}</p><div className="auth-note"><ShieldCheck size={16}/> Your school workspace is being initialized securely.</div><Link href="/login" className="auth-foot">Go to sign in</Link></>}</section></main>;
}
