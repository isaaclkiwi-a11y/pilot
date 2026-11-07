'use client';
import SharedWorkspace from './shared-workspace';
type Section='overview'|'passes'|'students'|'staff'|'classes'|'attendance'|'schedule'|'bells'|'substitutes'|'announcements'|'analytics'|'activity'|'settings';
export default function Workspace({initialSection}:{initialSection?:Section}){return <SharedWorkspace initialSection={initialSection}/>;}
