import React from 'react';
import { Link } from 'react-router-dom';
import DocLayout, { H2, P, QA, MailLink } from './DocLayout';

const SUPPORT_EMAIL = 'support@swipedj.app';

export default function Support() {
  return (
    <DocLayout title="Support">

      <P>
        Need help with SwipeDJ? Email us at <MailLink address={SUPPORT_EMAIL} /> and
        we'll get back to you within two business days.
      </P>

      <H2>Common questions</H2>

      <QA q="I paid for the Spotify export but can't access it.">
        Your unlock is tied to your SwipeDJ account, not to the device you bought it on.
        Log in at{' '}
        <Link to="/login" style={{ color: 'var(--coral)', textDecoration: 'none', fontWeight: 600 }}>
          swipedj.app/login
        </Link>{' '}
        with the email you used at checkout and your playlist and export will be there.
        If you never set a password, check your email for the setup link we sent after
        your purchase.
      </QA>

      <QA q="I didn't get the email after paying.">
        Check your spam folder first. If it isn't there, email us with the address you
        used at checkout and we'll resend it.
      </QA>

      <QA q="How do I export to Spotify?">
        Finish swiping, open your playlist, and choose Export to Spotify. You'll be asked
        to connect your Spotify account, then we create the playlist for you. We only use
        that connection to build the playlist.
      </QA>

      <QA q="My DJ sent me a link. Do I still pay?">
        No. If you arrived through a DJ's invite link, the Spotify export is included and
        you won't see a charge.
      </QA>

      <QA q="I'm a DJ. How do invite links work?">
        Add a couple from your dashboard and copy their invite link. When they open it,
        their swipes appear in your dashboard in real time. Each couple gets their own link.
      </QA>

      <QA q="How do I delete my account?">
        Email <MailLink address={SUPPORT_EMAIL} /> and we'll delete your account and all
        associated data. See our{' '}
        <Link to="/privacy" style={{ color: 'var(--coral)', textDecoration: 'none', fontWeight: 600 }}>
          privacy policy
        </Link>{' '}
        for what we store.
      </QA>

      <H2>Still stuck?</H2>
      <P>
        Email <MailLink address={SUPPORT_EMAIL} />. Include the email address on your
        account and a short description of what happened — that's usually enough for us
        to sort it out.
      </P>

    </DocLayout>
  );
}
