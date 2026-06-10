import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const APP_STORE_URL = 'https://apps.apple.com/app/swipedj/idPLACEHOLDER';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

const TRACKS = [
  {
    title: "Low",
    artist: "Flo Rida · Mail on Sunday",
    tag: "Reception",
    art: "linear-gradient(135deg, #A8C8F0 0%, #4A7AC8 45%, #1A1A3A 90%)",
    glowA: "#4A7AC8",
    glowB: "#2A4A90",
  },
  {
    title: "I Wanna Dance With Somebody",
    artist: "Whitney Houston · Whitney",
    tag: "First Dance",
    art: "linear-gradient(135deg, #F5C8A0 0%, #E8802A 45%, #3A1A08 90%)",
    glowA: "#E8502A",
    glowB: "#C43E1F",
  },
  {
    title: "September",
    artist: "Earth, Wind & Fire · The Best Of",
    tag: "Cocktail Hour",
    art: "linear-gradient(135deg, #A0D8A0 0%, #2A8A4A 45%, #0A2A14 90%)",
    glowA: "#2A8A4A",
    glowB: "#1A5A2A",
  },
  {
    title: "Uptown Funk",
    artist: "Bruno Mars · Uptown Special",
    tag: "Reception",
    art: "linear-gradient(135deg, #F0A8C0 0%, #C83060 45%, #280A18 90%)",
    glowA: "#C83060",
    glowB: "#8A1A3A",
  },
];

export default function Landing() {
  const cardArtRef = useRef(null);
  const cardTitleRef = useRef(null);
  const cardArtistRef = useRef(null);
  const cardTagRef = useRef(null);
  const dotsRef = useRef([]);
  const stageRef = useRef(null);
  const curRef = useRef(0);

  useEffect(() => {
    function showTrack(i) {
      const t = TRACKS[i];
      if (cardArtRef.current) cardArtRef.current.style.background = t.art;
      if (cardTitleRef.current) cardTitleRef.current.textContent = t.title;
      if (cardArtistRef.current) cardArtistRef.current.textContent = t.artist;
      if (cardTagRef.current) cardTagRef.current.textContent = t.tag;
      document.documentElement.style.setProperty('--glow-a', t.glowA);
      document.documentElement.style.setProperty('--glow-b', t.glowB);
      dotsRef.current.forEach((d, idx) => {
        if (d) d.classList.toggle('active', idx === i);
      });
    }

    const timer = setInterval(() => {
      curRef.current = (curRef.current + 1) % TRACKS.length;
      showTrack(curRef.current);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  function handleDotClick(i) {
    curRef.current = i;
    const t = TRACKS[i];
    if (cardArtRef.current) cardArtRef.current.style.background = t.art;
    if (cardTitleRef.current) cardTitleRef.current.textContent = t.title;
    if (cardArtistRef.current) cardArtistRef.current.textContent = t.artist;
    if (cardTagRef.current) cardTagRef.current.textContent = t.tag;
    document.documentElement.style.setProperty('--glow-a', t.glowA);
    document.documentElement.style.setProperty('--glow-b', t.glowB);
    dotsRef.current.forEach((d, idx) => {
      if (d) d.classList.toggle('active', idx === i);
    });
  }

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
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#djs">For DJs</a>
              <a href="#faq">FAQ</a>
            </div>
            {isIOS
              ? <a href={APP_STORE_URL} className="nav-cta">Get the app</a>
              : <Link to="/app" className="nav-cta">Get the app</Link>
            }
          </div>
        </nav>

        {/* HERO */}
        <header className="hero">
          <div className="container hero-grid">
            <div>
              <h1 className="headline">
                Build your wedding playlist,<br />
                <em>one swipe at a time.</em>
              </h1>
              <p className="lede">
                Like Tinder for your wedding playlist: swipe right on the songs that feel like you,
                left on the ones that don't. SwipeDJ turns hours of arguing into a 15-minute date night.
              </p>
              <div className="hero-ctas">
                <Link className="btn-primary" to="/app">
                  Start swiping free
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                </Link>
                <a className="appstore" href={isIOS ? APP_STORE_URL : '#cta'}>
                  <svg className="appstore-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.05 12.5c0-2.95 2.4-4.36 2.5-4.43-1.36-2-3.49-2.27-4.24-2.3-1.81-.18-3.53 1.07-4.45 1.07-.93 0-2.34-1.05-3.85-1.02-1.98.03-3.81 1.15-4.83 2.92-2.06 3.58-.53 8.86 1.48 11.77 1 1.42 2.18 3.02 3.74 2.96 1.5-.06 2.07-.97 3.88-.97 1.81 0 2.32.97 3.91.94 1.61-.03 2.63-1.45 3.61-2.88 1.13-1.65 1.6-3.25 1.62-3.34-.04-.02-3.11-1.19-3.14-4.72zM14.34 4c.81-1 1.36-2.36 1.21-3.74-1.17.05-2.6.78-3.43 1.76-.75.87-1.41 2.27-1.23 3.61 1.31.1 2.64-.66 3.45-1.63z"/>
                  </svg>
                  <span className="appstore-text">
                    <span className="small">Download on the</span>
                    <span className="big">App Store</span>
                  </span>
                </a>
              </div>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <span className="hero-meta-num">800+</span>
                  <span className="hero-meta-label">Songs in the mix</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num">Free</span>
                  <span className="hero-meta-label">To build your list</span>
                </div>
                <div className="hero-meta-item">
                  <span className="hero-meta-num">Spotify</span>
                  <span className="hero-meta-label">One-tap export</span>
                </div>
              </div>
            </div>

            {/* card stage */}
            <div className="stage" id="stage" ref={stageRef}>
              <div className="swipe-card-peek" aria-hidden="true"></div>

              <div className="swipe-indicator left" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </div>
              <span className="swipe-label" style={{ left: '-26px' }}>Skip</span>

              <div className="swipe-indicator right" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 17.5 19 7"/>
                </svg>
              </div>
              <span className="swipe-label" style={{ right: '-22px' }}>Add</span>

              <article className="swipe-card">
                <div className="card-art" ref={cardArtRef} style={{ background: TRACKS[0].art }}>
                  <span className="card-tag" ref={cardTagRef}>{TRACKS[0].tag}</span>
                </div>
                <div className="card-meta">
                  <div className="card-meta-text">
                    <h3 className="card-title" ref={cardTitleRef}>{TRACKS[0].title}</h3>
                    <p className="card-artist" ref={cardArtistRef}>{TRACKS[0].artist}</p>
                  </div>
                  <button className="card-play" aria-label="Play preview">
                    <svg viewBox="0 0 14 14" fill="currentColor"><path d="M2 1.5v11l10-5.5z"/></svg>
                  </button>
                </div>
                <div className="card-progress" aria-hidden="true"></div>
                <div className="card-time">
                  <span>0:48</span>
                  <span>3:12</span>
                </div>
              </article>

              <div className="track-dots" role="tablist" aria-label="Sample tracks">
                {TRACKS.map((_, i) => (
                  <button
                    key={i}
                    className={`track-dot${i === 0 ? ' active' : ''}`}
                    ref={el => dotsRef.current[i] = el}
                    onClick={() => handleDotClick(i)}
                    aria-label={`Track ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* HOW IT WORKS */}
        <section className="section" id="how">
          <div className="container">
            <p className="section-eyebrow">How it works</p>
            <h2 className="section-title">Two steps. No spreadsheet.</h2>
            <p className="section-sub">
              We pre-load smart suggestions based on your taste, your venue, and the moments you need to fill —
              ceremony, cocktails, first dance, last call.
            </p>

            <div className="steps">
              <article className="step">
                <p className="step-num">01</p>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12c4-3 8-3 12 0s8 3 6 0"/>
                    <circle cx="6" cy="14" r="1.3" fill="currentColor"/>
                    <circle cx="18" cy="10" r="1.3" fill="currentColor"/>
                  </svg>
                </div>
                <h3 className="step-title">Swipe songs</h3>
                <p className="step-body">
                  Tap through curated picks across genres and cultures. Swipe right to keep, left to skip,
                  and up to mark as a must-play.
                </p>
              </article>

              <article className="step">
                <p className="step-num">02</p>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12"/>
                    <path d="m7 10 5 5 5-5"/>
                    <path d="M5 21h14"/>
                  </svg>
                </div>
                <h3 className="step-title">Export to Spotify</h3>
                <p className="step-body">
                  One tap sends your saved songs straight to Spotify as a playlist — or export a clean CSV
                  to hand off to your DJ.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="section" id="pricing" style={{ paddingTop: '32px' }}>
          <div className="container">
            <p className="section-eyebrow">Pricing</p>
            <h2 className="section-title">Free to swipe.<br />Pay only when you're ready.</h2>
            <p className="section-sub">
              Build your full playlist for free. Pay once when you want to push it to Spotify, or get a license
              if you're a DJ running multiple weddings a month.
            </p>

            <div className="pricing-grid">

              {/* COUPLES */}
              <div className="plan plan-couples">
                <div className="plan-header">
                  <p className="plan-name">For Couples</p>
                  <span className="plan-badge">Most popular</span>
                </div>
                <h3 className="plan-tag">Your wedding playlist, exported and ready.</h3>
                <p className="plan-tag-sub">One-time unlock per wedding. No subscription, no renewals.</p>

                <div className="plan-price-row">
                  <span className="plan-price">$14</span>
                  <span className="plan-cents">.99</span>
                  <span className="plan-period">one time</span>
                </div>
                <p className="plan-fineprint">Both partners get full access. Cancel? There's nothing to cancel.</p>

                <ul className="plan-features">
                  {[
                    'Unlimited swiping for both partners',
                    'Export to Spotify as 5 timeline playlists',
                    'Share-with-DJ run-of-show PDF',
                    'Guest request mode for the reception',
                  ].map(f => (
                    <li key={f}>
                      <svg className="check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3.5 3.5L13 5"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link to="/app" className="plan-cta">
                  Unlock my playlist
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                </Link>
              </div>

              {/* DJ */}
              <div className="plan plan-dj" id="djs">
                <div className="plan-header">
                  <p className="plan-name">DJ License · Pro</p>
                  <span className="plan-badge">For Pros</span>
                </div>
                <h3 className="plan-tag">Run client intake, swipe-by-swipe.</h3>
                <p className="plan-tag-sub">A working tool for wedding DJs and planners managing recurring bookings.</p>

                <div className="plan-price-row">
                  <span className="plan-price">$49</span>
                  <span className="plan-period">/ month</span>
                </div>
                <p className="plan-fineprint">Billed monthly. Cancel anytime. Annual saves 20%.</p>

                <ul className="plan-features">
                  {[
                    'Unlimited client weddings & exports',
                    'White-labeled invite link with your branding',
                    'Pre-load your crate; surface your bangers first',
                    'Export to Rekordbox, Serato, Engine DJ',
                    'Live request screen for the booth',
                  ].map(f => (
                    <li key={f}>
                      <svg className="check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3.5 3.5L13 5"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <a href="#cta" className="plan-cta">
                  Start 14-day trial
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                </a>
              </div>

            </div>

            <div className="quote-band">
              <p>"Saved us a 4-hour fight about whether 'Mr. Brightside' belongs at a wedding. (It does. We swiped right.)"</p>
              <cite>— Maya &amp; Theo, married Sep 2025</cite>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq">
          <div className="container">
            <h2 className="section-title" style={{ marginBottom: '40px', color: 'var(--coral)' }}>FAQ</h2>

            <div className="faq-list">
              {[
                {
                  q: "How does SwipeDJ work?",
                  a: "SwipeDJ gives both partners a curated list of 800+ wedding-ready songs. Swipe right to keep a song, left to skip it, and up to mark it as a must-play. When you're done, export your saved songs straight to Spotify or as a CSV for your DJ.",
                },
                {
                  q: "Do both partners have to swipe at the same time?",
                  a: "Nope. Each partner can swipe on their own device whenever works for them. It's actually more fun that way — no peeking at each other's choices.",
                },
                {
                  q: "What kind of music is in the database?",
                  a: "800+ songs spanning pop, R&B, hip-hop, country, Latin, Afrobeats, K-pop, South Asian, and classic wedding staples. We've curated for danceability, crowd appeal, and cultural range so there's something for every kind of wedding.",
                },
                {
                  q: "Is it really free to start?",
                  a: "Yes. Swiping and building your list is completely free. You only pay when you're ready to export.",
                },
                {
                  q: "How does the Spotify export work?",
                  a: "Once you unlock the export ($14.99, one time), your saved songs are pushed directly to Spotify as a playlist. That unlock is permanent — you can re-export as many times as you want, so keep swiping and updating your list right up until the wedding.",
                },
                {
                  q: "I don't have Spotify. Can I still use SwipeDJ?",
                  a: "Yes. You can export your list as a CSV file instead, which you can hand directly to your DJ or use however you like.",
                },
                {
                  q: "Is there an Android version?",
                  a: "iOS only for now, with Android coming soon.",
                },
                {
                  q: "Can I add my own songs?",
                  a: "Yes. If there's a song you love that isn't in our database, you can import it and add it to your list alongside your swipes.",
                },
                {
                  q: "Is there a limit to how many songs I can save?",
                  a: "No limit. Swipe right on everything you love and trim it down later.",
                },
                {
                  q: "What is the DJ license for?",
                  a: "The DJ license ($49/month) is for wedding DJs and planners managing multiple couples. It gives you a dashboard to track all your clients, view their playlists and do-not-plays in real time, and send couples a branded invite link. Couples who come in through a DJ's invite link have their Spotify export covered — no extra charge on their end.",
                },
                {
                  q: "How does the DJ invite link work?",
                  a: "When you add a client in your dashboard, SwipeDJ generates a unique invite link for that couple. Send it to them however you like — text, email, WhatsApp. When they open it, they're dropped straight into the swipe experience and their choices sync to your dashboard automatically.",
                },
                {
                  q: "How does pricing work for DJ-linked couples?",
                  a: "If a couple comes in through a DJ's invite link, their export is fully covered by the DJ's subscription. No double charges.",
                },
              ].map(({ q, a }) => (
                <details key={q} className="faq-item">
                  <summary className="faq-q">{q}</summary>
                  <p className="faq-a">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FOOTER */}
        <section className="cta-footer" id="cta">
          <div className="container">
            <h2 className="cta-title">Your first dance<br />is one swipe away.</h2>
            <p className="cta-sub">
              Free to download. Free to build your list. Pay once you're ready to make it real.
            </p>
            <div className="cta-buttons">
              <Link className="btn-primary" to="/app">
                Start swiping free
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
              </Link>
              <a className="appstore" href={isIOS ? APP_STORE_URL : '#cta'}>
                <svg className="appstore-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 12.5c0-2.95 2.4-4.36 2.5-4.43-1.36-2-3.49-2.27-4.24-2.3-1.81-.18-3.53 1.07-4.45 1.07-.93 0-2.34-1.05-3.85-1.02-1.98.03-3.81 1.15-4.83 2.92-2.06 3.58-.53 8.86 1.48 11.77 1 1.42 2.18 3.02 3.74 2.96 1.5-.06 2.07-.97 3.88-.97 1.81 0 2.32.97 3.91.94 1.61-.03 2.63-1.45 3.61-2.88 1.13-1.65 1.6-3.25 1.62-3.34-.04-.02-3.11-1.19-3.14-4.72zM14.34 4c.81-1 1.36-2.36 1.21-3.74-1.17.05-2.6.78-3.43 1.76-.75.87-1.41 2.27-1.23 3.61 1.31.1 2.64-.66 3.45-1.63z"/>
                </svg>
                <span className="appstore-text">
                  <span className="small">Download on the</span>
                  <span className="big">App Store</span>
                </span>
              </a>
            </div>
          </div>

          <div className="footer-bar">
            <div className="container footer-row">
              <a href="/" className="brand">
                <img src="/swipeDJ logo.svg" alt="SwipeDJ" style={{ height: '28px' }} />
              </a>
              <div className="footer-links">
                <a href="#how">How it works</a>
                <a href="#pricing">Pricing</a>
                <a href="#djs">For DJs</a>
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a href="#privacy">Privacy</a>
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a href="#support">Support</a>
              </div>
              <div className="footer-meta">© 2026 · Made for the dance floor</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
