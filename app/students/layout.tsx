import {requirePilotMember} from '@/lib/auth';
export default async function StudentsLayout({children}:{children:React.ReactNode}){await requirePilotMember();return children;}