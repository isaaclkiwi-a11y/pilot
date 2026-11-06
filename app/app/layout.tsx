import {requirePilotMember} from '@/lib/auth';
export default async function AppLayout({children}:{children:React.ReactNode}){await requirePilotMember();return children;}