import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export async function requirePilotMember() {
 const supabase = await createClient();
 const {data} = await supabase.auth.getClaims();
 const claims = data?.claims;
 if (!claims?.sub) redirect('/login');
 const {data:memberships,error} = await supabase.from('school_memberships').select('id,school_id,role').eq('user_id',claims.sub).eq('status','active').limit(1);
 if (error || !memberships?.length) redirect('/setup?finish=1');
 return {supabase,userId:claims.sub,membership:memberships[0]};
}