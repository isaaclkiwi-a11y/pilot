import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const authorization=req.headers.get("Authorization");if(!authorization?.startsWith("Bearer "))return json({error:"Administrator sign-in required."},401);
 const url=Deno.env.get("SUPABASE_URL"),anonKey=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anonKey||!serviceKey)return json({error:"Student QR service is not configured."},500);
 const userClient=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authData,error:authError}=await userClient.auth.getUser();if(authError||!authData.user)return json({error:"Administrator session could not be verified."},401);
 const {data:membership}=await admin.from("school_memberships").select("school_id,role").eq("user_id",authData.user.id).eq("status","active").in("role",["owner","school_admin","staff_admin"]).limit(1).maybeSingle();
 if(!membership)return json({error:"Only school administrators can manage student QR credentials."},403);
 let body:{action?:string;student_id?:string;credential_id?:string};try{body=await req.json();}catch{return json({error:"Invalid request body."},400);}
 if(body.action==="issue"){
  if(!body.student_id)return json({error:"Choose a student first."},400);
  const {data:s}=await admin.from("students").select("id,school_id,auth_user_id,first_name,last_name,status").eq("id",body.student_id).eq("school_id",membership.school_id).maybeSingle();
  if(!s||s.status!=="active")return json({error:"Active student not found in your school."},404);
  const token=randomToken();let authUserId=s.auth_user_id as string|null;let createdUserId:string|null=null;
  if(authUserId){const {error}=await admin.auth.admin.updateUserById(authUserId,{password:token});if(error)return json({error:"Could not rotate the student credential: "+error.message},500);}
  else{const email="student-"+s.id.replaceAll("-","")+"@students.pilot.invalid";const {data,error}=await admin.auth.admin.createUser({email,password:token,email_confirm:true,user_metadata:{full_name:[s.first_name,s.last_name].filter(Boolean).join(" ")}});if(error||!data.user)return json({error:"Could not create student login: "+(error?.message||"Unknown error")},500);authUserId=data.user.id;createdUserId=data.user.id;}
  const {data:credential,error:credentialError}=await userClient.rpc("issue_student_qr_credential",{p_student_id:s.id,p_auth_user_id:authUserId,p_token:token});
  if(credentialError||!credential){if(createdUserId)await admin.auth.admin.deleteUser(createdUserId);return json({error:credentialError?.message||"Credential could not be saved."},400);}
  return json({credential_id:credential.credential_id,token,expires_at:credential.expires_at,student_name:[s.first_name,s.last_name].filter(Boolean).join(" ")});
 }
 if(body.action==="revoke"){
  if(!body.credential_id)return json({error:"Choose a credential to revoke."},400);
  const {data:c}=await admin.from("student_qr_credentials").select("id,school_id,student_id").eq("id",body.credential_id).eq("school_id",membership.school_id).maybeSingle();
  if(!c)return json({error:"Credential not found in your school."},404);
  const {data:s}=await admin.from("students").select("auth_user_id").eq("id",c.student_id).eq("school_id",membership.school_id).maybeSingle();
  const {error}=await userClient.rpc("revoke_student_qr_credential",{p_credential_id:c.id});if(error)return json({error:error.message},400);
  if(s?.auth_user_id){const {error:rotateError}=await admin.auth.admin.updateUserById(s.auth_user_id,{password:randomToken()});if(rotateError)return json({error:"QR revoked, but the account password could not be rotated: "+rotateError.message},500);}
  return json({success:true});
 }
 return json({error:"Unknown action."},400);
});