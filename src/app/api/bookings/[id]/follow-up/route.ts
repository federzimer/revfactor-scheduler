import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { isFollowUpTemplateKey } from '@/lib/follow-up-templates';
import { prisma } from '@/lib/prisma';

const SUBJECT_MAX_LENGTH = 160;
const BODY_MAX_LENGTH = 10_000;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emailHtml(message: string) {
  const paragraphs = message
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 18px;line-height:1.65;white-space:pre-line">${escapeHtml(paragraph)}</p>`)
    .join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f1ed;color:#173a33;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">A follow-up from RevFactor</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f1ed;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dedad2">
          <tr><td style="padding:28px 34px 20px;border-top:4px solid #a33a3a">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#13352f;margin-bottom:26px">revfactor</div>
            ${paragraphs}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me || !me.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (me.role !== 'super_admin' && booking.userId !== me.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (booking.outcome !== 'completed') {
    return NextResponse.json({ error: 'Mark the call completed before sending a follow-up.' }, { status: 409 });
  }

  const body = await req.json();
  const templateKey = body.templateKey;
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!isFollowUpTemplateKey(templateKey)) {
    return NextResponse.json({ error: 'Choose a valid follow-up template.' }, { status: 400 });
  }
  if (!subject || subject.length > SUBJECT_MAX_LENGTH) {
    return NextResponse.json({ error: `Subject must be between 1 and ${SUBJECT_MAX_LENGTH} characters.` }, { status: 400 });
  }
  if (!message || message.length > BODY_MAX_LENGTH) {
    return NextResponse.json({ error: `Message must be between 1 and ${BODY_MAX_LENGTH} characters.` }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Email sending is not configured yet.' }, { status: 503 });
  }

  const audit = await prisma.bookingFollowUp.create({
    data: {
      bookingId: booking.id,
      templateKey,
      subject,
      body: message,
      sentByUserId: me.id,
      sentByName: me.name,
      sentByEmail: me.email,
    },
  });

  let providerMessageId: string | null = null;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.FOLLOW_UP_FROM_EMAIL || 'RevFactor <no-reply@revfactor.io>',
        to: [booking.visitorEmail],
        reply_to: me.email || undefined,
        subject,
        text: message,
        html: emailHtml(message),
      }),
    });
    const providerResult = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(providerResult.message || `Email provider returned ${response.status}`);
    }
    providerMessageId = providerResult.id || null;
  } catch (error) {
    const providerError = error instanceof Error ? error.message : 'Email provider error';
    await prisma.bookingFollowUp.update({
      where: { id: audit.id },
      data: { status: 'failed', error: providerError.slice(0, 1000) },
    });
    console.error('[booking follow-up] send failed:', error);
    return NextResponse.json({ error: 'The email could not be sent. Please try again.' }, { status: 502 });
  }

  // Delivery has succeeded at this point. Do not tell the rep it failed if only the
  // audit update hiccups, since retrying would send the lead a duplicate email.
  const sentAt = new Date();
  try {
    await prisma.bookingFollowUp.update({
      where: { id: audit.id },
      data: { status: 'sent', providerMessageId, sentAt },
    });
  } catch (error) {
    console.error('[booking follow-up] sent, but audit update failed:', error);
  }

  return NextResponse.json({
    followUp: {
      id: audit.id,
      templateKey: audit.templateKey,
      subject: audit.subject,
      status: 'sent',
      sentByName: audit.sentByName,
      sentAt,
    },
  });
}
