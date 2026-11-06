import {redirect} from 'next/navigation';
import {requirePilotMember} from '@/lib/auth';
import SecurityConsole from './security-console';

export default async function SecurityPage(){
 const {supabase,membership}=await requirePilotMember();
 if(membership.role!=='security') redirect('/app');
 const {data:school}=await supabase.from('schools').select('name').eq('id',membership.school_id).maybeSingle();
 return <SecurityConsole schoolName={school?.name||'Your school'} role={membership.role}/>;
}
