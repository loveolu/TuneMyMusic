// Email service using Resend (with nodemailer as fallback)
// Lazy-loaded to avoid crashes when credentials aren't set.

export interface EmailUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface TransferSummary {
  id: string;
  sourcePlaylistName?: string | null;
  destinationPlaylistName?: string | null;
  sourcePlatform?: string;
  destinationPlatform?: string;
  totalTracks: number;
  matchedTracks: number;
  failedTracks: number;
  matchRate: number;
}

export interface ScheduleResult {
  id: string;
  totalTracks: number;
  matchedTracks: number;
}

export interface WeeklyStats {
  playlistsTransferred: number;
  totalTracks: number;
  matchedTracks: number;
}

// Lazy-load Resend
let _resend: any = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  try {
    const { Resend } = require('resend');
    _resend = new Resend(key);
  } catch {
    // resend package not installed
    _resend = null;
  }
  return _resend;
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'TuneMyMusic <noreply@tunemymusic.app>';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    // Log to console in development, silently skip in production if not configured
    if (process.env.NODE_ENV !== 'production') {
      console.log('[EmailService] Would send email:', { to, subject });
    }
    return;
  }
  await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
}

function greeting(user: EmailUser): string {
  return user.name ? `Hi ${user.name},` : 'Hi there,';
}

function footer(): string {
  return `
    <p style="color:#6b7280;font-size:12px;margin-top:32px;">
      You received this email because you have an account at TuneMyMusic.<br>
      <a href="https://tunemymusic.app/settings/notifications">Manage email preferences</a>
    </p>
  `;
}

export async function sendTransferComplete(
  user: EmailUser,
  transfer: TransferSummary,
): Promise<void> {
  const subject = `Transfer complete: ${transfer.sourcePlaylistName ?? 'Your playlist'}`;
  const html = `
    <h2>Your transfer is complete!</h2>
    <p>${greeting(user)}</p>
    <p>
      <strong>${transfer.sourcePlaylistName ?? 'Your playlist'}</strong> has been transferred
      from ${transfer.sourcePlatform ?? 'source'} to ${transfer.destinationPlatform ?? 'destination'}.
    </p>
    <table style="border-collapse:collapse;">
      <tr><td style="padding:4px 12px 4px 0;"><strong>Matched:</strong></td><td>${transfer.matchedTracks} / ${transfer.totalTracks} tracks</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>Match rate:</strong></td><td>${transfer.matchRate.toFixed(1)}%</td></tr>
      ${transfer.failedTracks > 0 ? `<tr><td style="padding:4px 12px 4px 0;"><strong>Not found:</strong></td><td>${transfer.failedTracks} tracks</td></tr>` : ''}
    </table>
    <p><a href="https://tunemymusic.app/transfers/${transfer.id}" style="color:#7c3aed;">View transfer details</a></p>
    ${footer()}
  `;
  await sendEmail(user.email, subject, html);
}

export async function sendTransferFailed(
  user: EmailUser,
  transfer: TransferSummary,
  error: string,
): Promise<void> {
  const subject = `Transfer failed: ${transfer.sourcePlaylistName ?? 'Your playlist'}`;
  const html = `
    <h2>Your transfer failed</h2>
    <p>${greeting(user)}</p>
    <p>
      Unfortunately, the transfer of <strong>${transfer.sourcePlaylistName ?? 'your playlist'}</strong>
      from ${transfer.sourcePlatform ?? 'source'} to ${transfer.destinationPlatform ?? 'destination'} failed.
    </p>
    <p><strong>Error:</strong> ${error}</p>
    <p><a href="https://tunemymusic.app/transfers/${transfer.id}" style="color:#7c3aed;">View transfer &amp; retry</a></p>
    ${footer()}
  `;
  await sendEmail(user.email, subject, html);
}

export async function sendSyncComplete(
  user: EmailUser,
  schedule: { id: string; name?: string },
  result: ScheduleResult,
): Promise<void> {
  const subject = `Scheduled sync complete`;
  const html = `
    <h2>Scheduled sync complete!</h2>
    <p>${greeting(user)}</p>
    <p>
      Your scheduled sync${schedule.name ? ` for <strong>${schedule.name}</strong>` : ''} completed successfully.
    </p>
    <p>${result.matchedTracks} / ${result.totalTracks} tracks synced.</p>
    ${footer()}
  `;
  await sendEmail(user.email, subject, html);
}

export async function sendWeeklyDigest(user: EmailUser, stats: WeeklyStats): Promise<void> {
  if (stats.playlistsTransferred === 0) return; // Don't send empty digests
  const subject = `Your TuneMyMusic weekly recap`;
  const html = `
    <h2>Your week in music</h2>
    <p>${greeting(user)}</p>
    <p>Here's what you transferred this week:</p>
    <table style="border-collapse:collapse;">
      <tr><td style="padding:4px 12px 4px 0;"><strong>Playlists transferred:</strong></td><td>${stats.playlistsTransferred}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>Total tracks:</strong></td><td>${stats.totalTracks}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong>Tracks matched:</strong></td><td>${stats.matchedTracks}</td></tr>
    </table>
    <p><a href="https://tunemymusic.app/transfers" style="color:#7c3aed;">View your transfer history</a></p>
    ${footer()}
  `;
  await sendEmail(user.email, subject, html);
}

export async function sendWelcome(user: EmailUser): Promise<void> {
  const subject = `Welcome to TuneMyMusic!`;
  const html = `
    <h2>Welcome to TuneMyMusic!</h2>
    <p>${greeting(user)}</p>
    <p>Thanks for signing up! You can now transfer your music playlists between any streaming service in minutes.</p>
    <p><a href="https://tunemymusic.app/transfers/new" style="color:#7c3aed;">Start your first transfer</a></p>
    <p>
      <strong>Your Free plan includes:</strong>
      <ul>
        <li>3 transfers per month</li>
        <li>Up to 200 tracks per transfer</li>
        <li>2 platform connections</li>
      </ul>
    </p>
    ${footer()}
  `;
  await sendEmail(user.email, subject, html);
}
