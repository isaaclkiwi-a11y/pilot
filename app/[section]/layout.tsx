import {requirePilotMember} from '@/lib/auth';
export default async function SectionLayout({children}:{children:React.ReactNode}){await requirePilotMember();return children;}