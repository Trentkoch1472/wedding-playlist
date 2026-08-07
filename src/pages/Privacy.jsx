import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const APP_STORE_URL = 'https://apps.apple.com/app/swipedj/idPLACEHOLDER';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Long-form legal copy: wide leading and a ~720px measure, since this is read
// rather than scanned.
const PROSE = {
  maxWidth: '720px',
  margin: '0 auto',
  fontSize: '17px',
  lineHeight: 1.75,
  color: 'var(--ink-dim)',
};

function H2({ children }) {
  return (
    <h2 style={{
      fontFamily: '"Inter Tight", sans-serif',
      fontSize: '24px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: 'var(--ink)',
      margin: '48px 0 12px',
    }}>{children}</h2>
  );
}

function P({ children }) {
  return <p style={{ margin: '0 0 18px' }}>{children}</p>;
}

function Lead({ children }) {
  return <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{children}</strong>;
}

export default function Privacy() {
  return (
    <div className="lp">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div className="page">

        {/* NAV */}
        <nav className="nav">
          <div className="container nav-row">
            <a href="/" className="brand">
              <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '28px' }} />
            </a>
            <div className="nav-links">
              <a href="/#how">How it works</a>
              <a href="/#pricing">Pricing</a>
              <Link to="/for-djs">For DJs</Link>
              <a href="/#faq">FAQ</a>
            </div>
            <div className="nav-actions">
              <Link to="/login" className="nav-login">Log in</Link>
              {isIOS
                ? <a href={APP_STORE_URL} className="nav-cta">Get the app</a>
                : <Link to="/app" className="nav-cta">Get the app</Link>
              }
            </div>
          </div>
        </nav>

        <section className="section" style={{ paddingTop: '64px', paddingBottom: '56px' }}>
          <div className="container">
            <div style={PROSE}>

              <h1 style={{
                fontFamily: '"Inter Tight", sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(34px, 5vw, 48px)',
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                color: 'var(--ink)',
                margin: '0 0 12px',
              }}>Privacy Policy</h1>

              <p style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--coral)',
                margin: '0 0 40px',
              }}>Last updated: August 7, 2026</p>

              <P>
                SwipeDJ helps couples build wedding playlists and share them with their DJ.
                This policy explains what we collect, why, and what you can do about it.
              </P>

              <H2>What we collect</H2>
              <P>
                <Lead>Account information.</Lead> Your email address, and a password stored as a
                secure hash. We never store your password in a readable form.
              </P>
              <P>
                <Lead>Your song choices.</Lead> The songs you swipe on, the playlist you build,
                and any songs you mark as must-haves.
              </P>
              <P>
                <Lead>Spotify connection.</Lead> If you choose to export your playlist to Spotify,
                we receive an access token from Spotify that lets us create a playlist in your
                account. We use it only for that purpose. We do not read your listening history,
                your existing playlists, or your profile beyond what is needed to create the playlist.
              </P>
              <P>
                <Lead>Wedding details.</Lead> If your DJ invited you, they may have entered your
                names and wedding date. That information is visible to them.
              </P>
              <P>
                <Lead>Payment information.</Lead> Purchases are processed by Stripe. We never see
                or store your card number. We keep a Stripe customer identifier so we can recognize
                your purchase.
              </P>

              <H2>How we use it</H2>
              <P>
                To build and save your playlist, to let you access it from any device, to share it
                with your DJ if you were invited by one, and to confirm your purchase so you are not
                charged twice.
              </P>
              <P>
                We do not sell your personal information. We do not share it with advertisers.
              </P>

              <H2>Who we share it with</H2>
              <P>We use a small number of service providers to run SwipeDJ:</P>
              <ul style={{ margin: '0 0 18px', paddingLeft: '22px' }}>
                {[
                  ['Supabase', 'stores your account and playlist data'],
                  ['Stripe', 'processes payments'],
                  ['Spotify', 'receives playlist data only when you choose to export'],
                  ['Resend', 'sends account emails'],
                  ['Vercel', 'hosts the application'],
                ].map(([name, role]) => (
                  <li key={name} style={{ margin: '0 0 8px' }}>
                    <Lead>{name}</Lead> {role}
                  </li>
                ))}
              </ul>
              <P>
                Each of these has access only to what it needs to perform its function.
              </P>
              <P>
                If you were invited by a DJ, that DJ can see your playlist, your song choices, and
                any wedding details entered for you. That is the point of the invite, and it is the
                only sharing of that kind we do.
              </P>

              <H2>How long we keep it</H2>
              <P>
                We keep your account and playlist data until you ask us to delete it. Wedding
                playlists tend to matter for a while after the wedding, so we do not delete on a timer.
              </P>

              <H2>Your choices</H2>
              <P>
                You can ask us to delete your account and all associated data at any time. You can
                disconnect Spotify at any time from your Spotify account settings, which revokes our
                access immediately. You can ask for a copy of the data we hold about you.
              </P>
              <P>
                To make any of these requests, email us at the address below.
              </P>

              <H2>Children</H2>
              <P>
                SwipeDJ is not directed at children under 13, and we do not knowingly collect
                information from them.
              </P>

              <H2>Changes</H2>
              <P>
                If we change this policy, we will update the date at the top of this page. Material
                changes will be communicated by email to registered users.
              </P>

              <H2>Contact</H2>
              <P>
                Questions about this policy or your data:{' '}
                <a href="mailto:privacy@swipedj.app" style={{ color: 'var(--coral)', textDecoration: 'none', fontWeight: 600 }}>
                  privacy@swipedj.app
                </a>
              </P>

            </div>
          </div>
        </section>

        {/* FOOTER */}
        <div className="footer-bar">
          <div className="container footer-row">
            <a href="/" className="brand">
              <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '28px' }} />
            </a>
            <div className="footer-links">
              <a href="/#how">How it works</a>
              <a href="/#pricing">Pricing</a>
              <Link to="/for-djs">For DJs</Link>
              <Link to="/privacy">Privacy</Link>
            </div>
            <div className="footer-meta">© 2026 · Made for the dance floor</div>
          </div>
        </div>

      </div>
    </div>
  );
}
