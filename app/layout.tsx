import type { Metadata } from 'next';
import './globals.css';
import './auth.css';
export const metadata:Metadata={title:'Pilot | School Operations',description:'A connected school operations workspace.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}