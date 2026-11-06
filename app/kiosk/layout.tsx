import {redirect} from 'next/navigation';
import {requirePilotMember} from '@/lib/auth';
export default async function KioskLayout({children}:{children:React.ReactNode}){
 const {membership}=await requirePilotMember();
 if(membership.role!=='kiosk')redirect('/app');
 return children;
}
