import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

/* ─────────────────────────────────────────────────────────────
   Dashboard mocks
   Static markup, not screenshots — stays crisp at any density and
   can't leak real client data the way the previous capture did.
   Every value below is fictional; both mocks are aria-hidden.
   ───────────────────────────────────────────────────────────── */

const SURFACE   = '#1A1A1A';
const HAIRLINE  = '#2A2A2A';
const CORAL     = '#E8502A';
const INK       = '#ffffff';
const INK_DIM   = '#888888';

// Mirrors statusColor() in DJDashboard.jsx so the mock reads as the real thing.
const PILL = {
  ready:   { background: '#1a3a1a', color: '#4ade80', border: '1px solid #166534' },
  swiping: { background: '#2a2a1a', color: '#fbbf24', border: '1px solid #92400e' },
  invited: { background: '#1a2a3a', color: '#60a5fa', border: '1px solid #1e40af' },
  pending: { background: '#1C1C1E', color: INK_DIM, border: `1px solid ${HAIRLINE}` },
};

function Pill({ tone, children }) {
  return (
    <span style={{
      ...PILL[tone],
      fontSize: '10px', fontWeight: 600, padding: '3px 9px', borderRadius: '999px',
      letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function RingAvatar() {
  return (
    <span style={{
      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
      background: '#242424', border: `1px solid ${HAIRLINE}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={CORAL} strokeWidth="1.5">
        <circle cx="8" cy="10" r="4.25" />
        <path d="M8 5.5 6.4 3.2h3.2L8 5.5Z" fill={CORAL} stroke="none" />
      </svg>
    </span>
  );
}

function Chevron() {
  return <span style={{ color: '#444', fontSize: '15px', flexShrink: 0, lineHeight: 1 }}>›</span>;
}

function SectionLabel({ children, color = INK_DIM, style }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color, ...style,
    }}>{children}</span>
  );
}

const CLIENTS = [
  { name: 'Emma & Jordan',  sub: 'Sept 12, 2026 · 48 songs',  tone: 'ready',   label: 'Ready' },
  { name: 'Priya & Marcus', sub: 'Oct 3, 2026 · 31 songs',    tone: 'swiping', label: 'Swiping' },
  { name: 'Sofia & Daniel', sub: 'Oct 18, 2026 · 22 songs',   tone: 'swiping', label: 'Swiping' },
  { name: 'Hannah & Will',  sub: 'Nov 7, 2026 · Invite sent', tone: 'invited', label: 'Invited' },
  { name: 'Grace & Tomas',  sub: 'Nov 22, 2026 · Invite sent',tone: 'invited', label: 'Invited' },
  { name: 'Chloe & Andre',  sub: 'Dec 6, 2026',               tone: 'pending', label: 'Pending' },
];

const MUST_HAVES = [
  { title: 'At Last',   artist: 'Etta James' },
  { title: 'September', artist: 'Earth, Wind & Fire' },
];

// The genre and language spread here is deliberate — disco, pop, rock, salsa,
// country. It signals to DJs working multicultural weddings that the catalogue
// reaches past English-language pop. Keep the range if these are ever changed.
const PLAYLIST = [
  { title: 'Uptown Funk',                    artist: 'Mark Ronson ft. Bruno Mars' },
  { title: 'I Wanna Dance with Somebody',    artist: 'Whitney Houston' },
  { title: "Don't Stop Believin'",           artist: 'Journey' },
  { title: 'Periódico de Ayer',              artist: 'Willie Colón & Héctor Lavoe' },
  { title: 'Country Girl (Shake It for Me)', artist: 'Luke Bryan' },
];

function SongRow({ title, artist, star, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 14px',
      borderBottom: last ? 'none' : `1px solid ${HAIRLINE}`,
    }}>
      {star && <span style={{ color: '#fbbf24', fontSize: '11px', flexShrink: 0 }}>★</span>}
      <span style={{ fontSize: '12px', color: INK, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      <span style={{ fontSize: '11px', color: INK_DIM, marginLeft: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%' }}>{artist}</span>
    </div>
  );
}

function MockClientList() {
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: '14px',
      overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
    }}>
      {/* stat cards */}
      <div style={{ display: 'flex', gap: '10px', padding: '16px' }}>
        {[['24', 'Total clients'], ['6', 'Upcoming weddings'], ['3', 'Active sessions']].map(([v, l]) => (
          <div key={l} style={{
            flex: 1, background: '#141414', border: `1px solid ${HAIRLINE}`,
            borderRadius: '10px', padding: '12px',
          }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: INK, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: '10px', color: INK_DIM, marginTop: '5px' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 16px 12px',
      }}>
        <SectionLabel>Clients (24)</SectionLabel>
        <span style={{
          background: CORAL, color: '#fff', fontSize: '11px', fontWeight: 600,
          padding: '6px 12px', borderRadius: '8px', whiteSpace: 'nowrap',
        }}>+ Add couple</span>
      </div>

      {/* rows */}
      <div style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        {CLIENTS.map((c, i) => (
          <div key={c.name} style={{
            display: 'flex', alignItems: 'center', gap: '11px',
            padding: '11px 16px',
            borderBottom: i < CLIENTS.length - 1 ? `1px solid ${HAIRLINE}` : 'none',
          }}>
            <RingAvatar />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
              <div style={{ fontSize: '11px', color: INK_DIM, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sub}</div>
            </div>
            <Pill tone={c.tone}>{c.label}</Pill>
            <Chevron />
          </div>
        ))}
      </div>
    </div>
  );
}

function MockClientDetail() {
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: '14px',
      overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
    }}>
      {/* header */}
      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ fontSize: '11px', color: INK_DIM, marginBottom: '10px' }}>← Back to clients</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: INK, lineHeight: 1.2 }}>Emma &amp; Jordan</div>
            <div style={{ fontSize: '11px', color: INK_DIM, marginTop: '3px' }}>Sept 12, 2026 · Riverside Barn</div>
          </div>
          <Pill tone="ready">Ready</Pill>
        </div>
      </div>

      {/* invite link */}
      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ background: '#141414', border: `1px solid ${HAIRLINE}`, borderRadius: '10px', padding: '11px 12px' }}>
          <SectionLabel style={{ display: 'block', marginBottom: '8px' }}>Client invite link</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', color: '#cfcfcf',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
            }}>swipedj.app/app?client=8f2c41ae</span>
            <span style={{
              background: CORAL, color: '#fff', fontSize: '11px', fontWeight: 600,
              padding: '5px 12px', borderRadius: '7px', flexShrink: 0,
            }}>Copy</span>
          </div>
        </div>
      </div>

      {/* must haves */}
      <div style={{ padding: '0 16px 8px' }}>
        <SectionLabel color="#fbbf24">★ Must haves ({MUST_HAVES.length})</SectionLabel>
      </div>
      <div style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        {MUST_HAVES.map((s, i) => (
          <SongRow key={s.title} {...s} star last={i === MUST_HAVES.length - 1} />
        ))}
      </div>

      {/* playlist */}
      <div style={{ padding: '14px 16px 8px' }}>
        <SectionLabel>Playlist (48)</SectionLabel>
      </div>
      <div style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        {PLAYLIST.map((s, i) => (
          <SongRow key={s.title} {...s} last={i === PLAYLIST.length - 1} />
        ))}
      </div>
    </div>
  );
}

function DashboardMocks() {
  return (
    <div className="dj-mocks" aria-hidden="true">
      <style>{`
        .dj-mocks {
          position: relative;
          margin-top: 48px;
          /* Mock B is absolute and runs past Mock A's bottom edge; this reserves
             the room it needs so the pricing section can't collide with it. */
          padding-bottom: 148px;
        }
        .dj-mocks .mock-a { width: 68%; }
        .dj-mocks .mock-b {
          position: absolute;
          right: 0;
          /* Starts below Mock A's stat-card row instead of clipping it. */
          top: 104px;
          /* 68% + 32% + 16px resolves to a fixed 16px overlap at any container
             width. 16px is exactly Mock A's row padding, so the overlap covers
             the card edge and stops precisely where the chevron column ends —
             every status pill stays readable, which is the point of showing six
             rows. A wider overlap would bury the workflow it exists to show. */
          width: calc(32% + 16px);
        }
        /* Overlapping needs horizontal room. Below this the two stack, which
           also keeps the 11px row text from collapsing on phones. */
        @media (max-width: 1024px) {
          .dj-mocks { padding-bottom: 0; }
          .dj-mocks .mock-a { width: 100%; }
          .dj-mocks .mock-b {
            position: static;
            width: 100%;
            margin-top: 20px;
          }
        }
      `}</style>
      <div className="mock-a"><MockClientList /></div>
      <div className="mock-b"><MockClientDetail /></div>
    </div>
  );
}

export default function ForDJs() {
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
              <Link to="/for-djs" style={{ color: 'var(--coral)', fontWeight: 600 }}>For DJs</Link>
              <a href="/#faq">FAQ</a>
            </div>
            <div className="nav-actions">
              <Link to="/login" className="nav-login">Log in</Link>
              <Link to="/dj?role=dj" className="nav-cta">Create DJ account</Link>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <header className="hero" style={{ paddingBottom: '80px' }}>
          <div className="container" style={{ maxWidth: '760px' }}>
            <p className="section-eyebrow" style={{ marginBottom: '20px' }}>For Wedding DJs</p>
            <h1 className="headline" style={{ fontSize: 'clamp(34px, 5.5vw, 62px)', maxWidth: '700px' }}>
              Couples show up to your planning meeting with a blank form.{' '}
              <em>SwipeDJ fixes that.</em>
            </h1>
            <p className="lede" style={{ maxWidth: '580px', marginTop: '24px', marginBottom: '36px' }}>
              Give every couple a link before your first meeting. They swipe through songs together,
              build a shared playlist, and hand it to you — done.
            </p>
            <div className="hero-ctas">
              <Link className="btn-primary" to="/dj?role=dj">
                Start your DJ license
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        {/* HOW IT WORKS */}
        <section className="section" id="how" style={{ paddingTop: '0' }}>
          <div className="container">
            <p className="section-eyebrow">How it works</p>
            <h2 className="section-title">Three steps. Zero back-and-forth.</h2>

            <div className="steps" style={{ marginTop: '48px' }}>

              <article className="step">
                <p className="step-num">01</p>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7z" />
                  </svg>
                </div>
                <h3 className="step-title">Send the link</h3>
                <p className="step-body">
                  Share a personalized SwipeDJ invite with your couple before your planning meeting.
                </p>
              </article>

              <article className="step">
                <p className="step-num">02</p>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12c4-3 8-3 12 0s8 3 6 0" />
                    <circle cx="6" cy="14" r="1.3" fill="currentColor" />
                    <circle cx="18" cy="10" r="1.3" fill="currentColor" />
                  </svg>
                </div>
                <h3 className="step-title">They build the playlist</h3>
                <p className="step-body">
                  Couples swipe through songs together. Mutual picks build their list automatically.
                </p>
              </article>

              <article className="step">
                <p className="step-num">03</p>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                </div>
                <h3 className="step-title">You get the playlist</h3>
                <p className="step-body">
                  View every client's finalized playlist from your dashboard. Export to CSV in one click.
                </p>
              </article>

            </div>
          </div>
        </section>

        {/* DASHBOARD PREVIEW */}
        <section className="section" style={{ paddingTop: '0' }}>
          <div className="container">
            <p className="section-eyebrow">Dashboard</p>
            <h2 className="section-title">Your dashboard.<br />All your clients, all their playlists.</h2>
            <p className="section-sub">
              Manage every couple from one place. See their song choices in real time, generate
              invite links, and export finalized playlists whenever you're ready.
            </p>

            <DashboardMocks />
          </div>
        </section>

        {/* PRICING */}
        {/* .footer-bar carries margin-top:40px, so the stock 96px bottom padding
            made this transition 136px — wider than every other section gap.
            Trimmed locally rather than touching the shared footer rule, which
            the Landing page also relies on. */}
        <section className="section" id="pricing" style={{ paddingTop: '0', paddingBottom: '56px' }}>
          <div className="container">
            <p className="section-eyebrow">Pricing</p>
            <h2 className="section-title">Simple pricing.</h2>

            <div style={{ marginTop: '48px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
              <div className="plan plan-dj" style={{ display: 'block' }}>
                <div className="plan-header">
                  <p className="plan-name">DJ License · Pro</p>
                  <span className="plan-badge">For Pros</span>
                </div>

                <div className="plan-price-row">
                  <span className="plan-price">$49</span>
                  <span className="plan-period">/ month</span>
                </div>
                <p className="plan-fineprint">Billed monthly. Cancel anytime.</p>

                <ul className="plan-features" style={{ marginBottom: '32px' }}>
                  {[
                    'Unlimited clients',
                    'Real-time playlist sync',
                    'CSV export',
                    'Personalized invite links for every couple',
                  ].map(f => (
                    <li key={f}>
                      <svg className="check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m3 8 3.5 3.5L13 5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link to="/dj?role=dj" className="plan-cta">
                  Start your DJ license
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </Link>
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
              <a href="/#how">How it works</a>
              <a href="/#pricing">Pricing</a>
              <Link to="/for-djs">For DJs</Link>
              <a href="/#faq">FAQ</a>
              <Link to="/privacy">Privacy</Link>
              <Link to="/support">Support</Link>
            </div>
            <div className="footer-meta">© 2026 · Made for the dance floor</div>
          </div>
        </div>

      </div>
    </div>
  );
}
