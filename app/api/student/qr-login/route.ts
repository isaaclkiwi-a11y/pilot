import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
export async function POST(request:Request){
 let body:{token?:string};try{body=await request.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
 const token=body.token||'';if(token.length<48||token.length>160)return NextResponse.json({error:'Invalid or expired student QR credential.'},{status:401});
 const supabase=await createClient();
 const {data:email,error:lookupError}=await supabase.rpc('get_student_qr_login_email',{p_token:token});
 if(lookupError||!email)return NextResponse.json({error:'This student QR credential is invalid, expired, or revoked.'},{status:401});
 await supabase.auth.signOut({scope:'local'});
 const {error:signInError}=await supabase.auth.signInWithPassword({email,password:token});
 if(signInError)return NextResponse.json({error:'Student sign-in could not be completed. Ask the school office for a replacement QR.'},{status:401});
 return NextResponse.json({success:true},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}