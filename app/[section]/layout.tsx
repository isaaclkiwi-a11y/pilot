import {redirect} from 'next/navigation';
import {requirePilotMember} from '@/lib/auth';
export default async function SectionLayout({children}:{children:React.ReactNode}){
 const {membership}=await requirePilotMember();
 if(membership.role==='security') redirect('/security');
 if(membership.role==='student') redirect('/portal');
 if(membership.role==='kiosk') redirect('/kiosk');
 return children;
}