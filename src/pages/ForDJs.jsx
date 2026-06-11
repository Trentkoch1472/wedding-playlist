import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

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
            <Link to="/dj?role=dj" className="nav-cta">Create DJ account</Link>
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
                Create your free DJ account
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

            {/* FPO screenshot placeholder */}
            <div style={{
              marginTop: '48px',
              width: '100%',
              height: '400px',
              background: '#1A1A1A',
              border: '1px solid #2A2A2A',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#444444', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FPO</span>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="section" id="pricing" style={{ paddingTop: '0' }}>
          <div className="container">
            <p className="section-eyebrow">Pricing</p>
            <h2 className="section-title">Simple pricing.</h2>

            <div style={{ marginTop: '48px', maxWidth: '480px' }}>
              <div className="plan plan-dj" style={{ display: 'block' }}>
                <div className="plan-header">
                  <p className="plan-name">DJ License · Pro</p>
                  <span className="plan-badge">For Pros</span>
                </div>

                <div className="plan-price-row">
                  <span className="plan-price">$49</span>
                  <span className="plan-period">/ month</span>
                </div>
                <p className="plan-fineprint">Billed monthly. Cancel anytime. Annual saves 20%.</p>

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
                  Create your free DJ account
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
            </div>
            <div className="footer-meta">© 2026 · Made for the dance floor</div>
          </div>
        </div>

      </div>
    </div>
  );
}
