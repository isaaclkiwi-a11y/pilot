import {redirect} from 'next/navigation';
import {requirePilotMember} from '@/lib/auth';
export default async function StaffLayout({children}:{children:React.ReactNode}){
 const {membership}=await requirePilotMember();
 if(membership.role==='security') redirect('/security');
 return children;
}
// Security accounts are limited to their pass oversight workspace.
