'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Ban, Copy, MailPlus, ShieldCheck, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Invite = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export default function StaffInvitationsPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('teacher');
  const [schoolId, setSchoolId] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyInvite, setBusyInvite] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  const load = async () => {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) {
      setError('Sign in is required.');
      return;
    }
    const { data: membership, error: membershipError } = await db
      .from('school_memberships')
      .select('school_id,role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      setError(membershipError?.message || 'No active school membership was found.');
      return;
    }
    if (!['owner', 'school_admin', 'staff_admin'].includes(membership.role)) {
      setError('Only school administrators can manage invitations.');
      return;
    }

    setSchoolId(membership.school_id);
    const { data, error: inviteError } = await db
      .from('staff_invites')
      .select('id,email,display_name,role,expires_at,accepted_at,revoked_at')
      .eq('school_id', membership.school_id)
      .order('created_at', { ascending: false });

    if (inviteError) setError(inviteError.message);
    else setInvites(data || []);
  };

  useEffect(() => { void load(); }, []);

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setInviteUrl('');

    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user || !schoolId) {
      setError('Your school account could not be verified.');
      setBusy(false);
      return;
    }

    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await db.from('staff_invites').insert({
      school_id: schoolId,
      email: email.trim().toLowerCase(),
      display_name: displayName.trim(),
      role,
      token_hash: tokenHash,
      invited_by: user.id,
      expires_at: expires,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      const url = new URL('/invite', window.location.origin);
      url.searchParams.set('token', token);
      setInviteUrl(url.toString());
      setNotice('Invitation created. Copy the private link and send it to the staff member.');
      setEmail('');
      setDisplayName('');
      await load();
    }
    setBusy(false);
  }

  async function cancelInvite(invite: Invite) {
    if (invite.accepted_at || invite.revoked_at) return;
    if (!window.confirm(`Cancel the invitation for ${invite.email}? Its link will stop working.`)) return;

    setBusyInvite(invite.id);
    setError('');
    setNotice('');
    const db = createClient();
    const { data, error: cancelError } = await db
      .from('staff_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invite.id)
      .eq('school_id', schoolId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();

    if (cancelError) {
      setError(cancelError.message);
    } else if (!data) {
      setError('This invitation was already accepted, cancelled, or changed. Refresh the page and check its status.');
    } else {
      setNotice('Invitation cancelled. The old link can no longer be accepted.');
      await load();
    }
    setBusyInvite('');
  }

  return (
    <main className="admin-page">
      <div className="admin-top">
        <Link href="/staff" className="admin-back"><ArrowLeft size={16} /> Staff directory</Link>
        <span className="admin-chip"><ShieldCheck size={14} /> ADMIN TOOLS</span>
      </div>

      <div className="admin-heading">
        <div className="admin-icon"><Users /></div>
        <div>
          <span className="auth-eyebrow">PEOPLE & ACCESS</span>
          <h1>Staff invitations</h1>
          <p>Invite school staff with a name, role, and time-limited access link.</p>
        </div>
      </div>

      <section className="admin-panel">
        <h2>Create an invitation</h2>
        <p>Links expire after 7 days. Only the invited email address can accept. Admin-level roles cannot be assigned through invitations.</p>
        <form onSubmit={createInvite} className="invite-form">
          <label>Staff member name<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Full name" minLength={2} maxLength={120} required /></label>
          <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="colleague@school.edu" required /></label>
          <label>Role<select value={role} onChange={event => setRole(event.target.value)}><option value="teacher">Teacher</option><option value="staff">Staff</option><option value="security">Security</option><option value="substitute">Substitute</option><option value="kiosk">Kiosk device</option></select></label>
          <button className="auth-submit" disabled={busy}><MailPlus size={16} />{busy ? 'Creating…' : 'Create invitation'}</button>
        </form>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {notice && <div className="auth-success" role="status">{notice}</div>}
        {inviteUrl && <div className="invite-link"><code>{inviteUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(inviteUrl)}><Copy size={15} /> Copy link</button></div>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-title"><h2>Recent invitations</h2><span>{invites.length} total</span></div>
        {invites.length ? invites.map(invite => {
          const expired = new Date(invite.expires_at) < new Date();
          const state = invite.accepted_at ? 'accepted' : invite.revoked_at ? 'revoked' : expired ? 'expired' : 'pending';
          const canCancel = !invite.accepted_at && !invite.revoked_at;
          return (
            <div className="invite-row" key={invite.id}>
              <div>
                <b>{invite.display_name || invite.email}</b>
                <small>{invite.email} · {invite.role.replaceAll('_', ' ')} · Expires {new Date(invite.expires_at).toLocaleDateString()}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className={'invite-state ' + state}>{state.charAt(0).toUpperCase() + state.slice(1)}</span>
                {canCancel && <button type="button" className="secondary" onClick={() => void cancelInvite(invite)} disabled={busyInvite === invite.id || !!busy} aria-label={`Cancel invitation for ${invite.email}`}><Ban size={14} />{busyInvite === invite.id ? 'Cancelling…' : 'Cancel invite'}</button>}
              </div>
            </div>
          );
        }) : <div className="empty-admin">No invitations yet.</div>}
      </section>
    </main>
  );
}
