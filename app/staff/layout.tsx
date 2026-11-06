import {requirePilotMember} from '@/lib/auth';
export default async function StaffLayout({children}:{children:React.ReactNode}){await requirePilotMember();return children;}