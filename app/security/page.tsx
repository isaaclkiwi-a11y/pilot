import {redirect} from 'next/navigation';
import {requirePilotMember} from '@/lib/auth';
import SecurityConsole from './security-console';

export default async function SecurityPage(){
 const {membership}=await requirePilotMember();
 if(membership.role!=='security') redirect('/app');
 return <SecurityConsole schoolName="Your school" role={membership.role}/>;
}
