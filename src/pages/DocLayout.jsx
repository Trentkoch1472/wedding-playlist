import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

/* Shared shell for long-form document pages (/privacy, /support).
   Single-sourced so the nav, footer and prose treatment can't drift apart
   between them. */

const APP_STORE_URL = 'https://apps.apple.com/app/swipedj/idPLACEHOLDER';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Long-form copy: wide leading and a ~720px measure, since this is read
// rather than scanned.
const PROSE = {
  maxWidth: '720px',
  margin: '0 auto',
  fontSize: '17px',
  lineHeight: 1.75,
  color: 'var(--ink-dim)',
};

export function H2({ children }) {
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

export function P({ children }) {
  return <p style={{ margin: '0 0 18px' }}>{children}</p>;
}

export function Lead({ children }) {
  return <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{children}</strong>;
}

// A question-and-answer block: bold prompt on its own line, answer beneath.
export function QA({ q, children }) {
  return (
    <div style={{ margin: '0 0 26px' }}>
      <p style={{ margin: '0 0 6px', color: 'var(--ink)', fontWeight: 600 }}>{q}</p>
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}

export function MailLink({ address }) {
  return (
    <a href={`mailto:${address}`} style={{ color: 'var(--coral)', textDecoration: 'none', fontWeight: 600 }}>
      {address}
    </a>
  );
}

const FOOTER_LINKS = [
  { to: '/#how',      label: 'How it works', external: true },
  { to: '/#pricing',  label: 'Pricing',      external: true },
  { to: '/for-djs',   label: 'For DJs' },
  { to: '/privacy',   label: 'Privacy' },
  { to: '/support',   label: 'Support' },
];

export default function DocLayout({ title, updated, children }) {
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
              }}>{title}</h1>

              {updated && (
                <p style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--coral)',
                  margin: '0 0 40px',
                }}>{updated}</p>
              )}

              <div style={{ marginTop: updated ? 0 : '28px' }}>
                {children}
              </div>

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
              {FOOTER_LINKS.map(l => l.external
                ? <a key={l.label} href={l.to}>{l.label}</a>
                : <Link key={l.label} to={l.to}>{l.label}</Link>
              )}
            </div>
            <div className="footer-meta">© 2026 · Made for the dance floor</div>
          </div>
        </div>

      </div>
    </div>
  );
}
