import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';

/* ─── scroll-triggered visibility ─── */
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── animated count-up ─── */
function CountUp({ to, prefix = '', suffix = '', active }: { to: number; prefix?: string; suffix?: string; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cur = 0;
    const step = to / (1400 / 16);
    const t = setInterval(() => {
      cur += step;
      if (cur >= to) { setN(to); clearInterval(t); } else setN(parseFloat(cur.toFixed(1)));
    }, 16);
    return () => clearInterval(t);
  }, [to, active]);
  return <>{prefix}{n % 1 === 0 ? n.toLocaleString() : n.toFixed(1)}{suffix}</>;
}

/* ─── Transaction card mockup ─── */
function TxnCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,.08)', overflow: 'hidden', maxWidth: 420, width: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>TXN-4821</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 999 }}>IN_TRANSIT</span>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>White Maize · 12 tonnes</div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
          {['PAID', 'PICKED UP', 'IN TRANSIT', 'DELIVERED'].map((label, i) => {
            const done = i < 3;
            return (
              <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {/* Connector line */}
                {i < 3 && (
                  <div style={{ position: 'absolute', top: 8, left: '50%', width: '100%', height: 2, background: i < 2 ? '#15803d' : '#e5e7eb', zIndex: 0 }} />
                )}
                {/* Dot */}
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: done ? '#15803d' : '#e5e7eb', border: done ? 'none' : '2px solid #e5e7eb', position: 'relative', zIndex: 1, flexShrink: 0 }} />
                <div style={{ fontSize: 8, fontWeight: 700, color: done ? '#15803d' : '#9ca3af', marginTop: 6, textAlign: 'center', letterSpacing: '.03em' }}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Escrow notice */}
      <div style={{ padding: '10px 20px', background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>₦6,002,600 held by AgriFlow</div>
        <div style={{ fontSize: 10, color: '#4ade80', marginTop: 2 }}>Released to the supplier when the buyer confirms the goods arrived.</div>
      </div>

      {/* Parties */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { label: 'Supplier', name: 'Adeyemi Produce Co.', sub: 'Oyo State', emoji: '🌾' },
          { label: 'Carrier', name: 'SwiftHaul Logistics', sub: 'arriving 31 Aug', emoji: '🚛' },
        ].map(p => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{p.emoji}</div>
            <div>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{p.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{p.name} · <span style={{ color: '#6b7280', fontWeight: 400 }}>{p.sub}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── data ─── */
const HOW_IT_WORKS = [
  { n: '01', title: 'Post what you need', desc: 'Describe the commodity, grade, quantity and where it should be delivered.' },
  { n: '02', title: 'Review your matches', desc: 'AgriFlow surfaces verified suppliers with available stock. You choose — nothing is auto-assigned.' },
  { n: '03', title: 'Pay into protection', desc: 'Your payment is held by AgriFlow. The supplier prepares the goods and a carrier is assigned.' },
  { n: '04', title: 'Track, then confirm', desc: 'Follow the delivery in real time. Funds are released only once you confirm the goods arrived.' },
];

const FOR_ROLES = [
  {
    label: 'For buyers',
    desc: 'Source produce without the risk of paying up front and hoping for the best.',
    points: ['Post demand and compare verified suppliers', 'Payment held until you confirm receipt', 'Live delivery tracking on every order', 'One record of every transaction you have made'],
  },
  {
    label: 'For suppliers',
    desc: 'Reach serious buyers and know the money is there before you load a truck.',
    points: ['List available stock with your own pricing', 'Accept or reject each request on your terms', 'Payment confirmed before goods leave your yard', 'Logistics arranged for you by AgriFlow'],
  },
  {
    label: 'For carriers',
    desc: 'A steady flow of jobs with the paperwork already handled.',
    points: ['Receive assignments matched to your fleet', 'Full pickup and delivery details in one place', 'Confirm each leg from your phone', 'Report incidents directly to Operations'],
  },
];

const FAQ = [
  { q: 'What does it cost to join?', a: 'Creating an account is free for every role. AgriFlow charges a platform fee on completed transactions only — you pay nothing until a trade goes through.' },
  { q: 'How are suppliers and carriers verified?', a: 'Every business is checked before it can transact. Buyers can see completed transaction counts and history on each supplier profile.' },
  { q: 'When is the supplier actually paid?', a: 'After the buyer confirms the goods arrived as agreed. Until that moment the money is held by AgriFlow, not forwarded.' },
  { q: 'What happens if the goods are wrong?', a: 'Report an issue instead of confirming receipt. The funds stay held and AgriFlow Operations reviews the evidence from both sides before deciding.' },
];

const STATS = [
  { value: 2.4, prefix: '₦', suffix: 'bn', label: 'Traded through AgriFlow' },
  { value: 340, prefix: '', suffix: '+', label: 'Verified businesses' },
  { value: 98, prefix: '', suffix: '%', label: 'Delivered on schedule' },
  { value: 0, prefix: '', suffix: '', label: 'Payments lost to fraud' },
];

const COMPANY_LOGOS = [
  /* Flour Mills of Nigeria */
  <svg key="fmn" height="32" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#D35400"/>
    <text x="16" y="20.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Arial,sans-serif">FMN</text>
    <text x="48" y="12" fontSize="9" fontWeight="700" fill="#D35400" fontFamily="Arial,sans-serif" letterSpacing="0.5">FLOUR MILLS</text>
    <text x="48" y="24" fontSize="8" fontWeight="500" fill="#7c3b00" fontFamily="Arial,sans-serif" letterSpacing="0.3">OF NIGERIA</text>
  </svg>,
  /* Dangote Group */
  <svg key="dng" height="32" viewBox="0 0 150 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="8" width="4" height="16" rx="2" fill="#003399"/>
    <text x="12" y="20" fontSize="15" fontWeight="900" fill="#003399" fontFamily="Arial,sans-serif" letterSpacing="-0.3">DANGOTE</text>
    <text x="12" y="30" fontSize="7.5" fontWeight="600" fill="#6b7280" fontFamily="Arial,sans-serif" letterSpacing="1">GROUP</text>
  </svg>,
  /* Olam International */
  <svg key="olam" height="32" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="16" rx="14" ry="10" fill="none" stroke="#007A3D" strokeWidth="2.5"/>
    <path d="M10 16 Q16 8 22 16" stroke="#007A3D" strokeWidth="1.5" fill="none"/>
    <text x="36" y="21" fontSize="16" fontWeight="800" fill="#007A3D" fontFamily="Arial,sans-serif" letterSpacing="0.5">OLAM</text>
  </svg>,
  /* Nestlé Nigeria */
  <svg key="nestle" height="32" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 22 Q12 8 16 14 Q20 20 24 12" stroke="#003566" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <circle cx="16" cy="7" r="2.5" fill="#003566"/>
    <text x="30" y="21" fontSize="15" fontWeight="700" fill="#003566" fontFamily="Georgia,serif" letterSpacing="-0.2" fontStyle="italic">Nestlé</text>
    <text x="30" y="29" fontSize="7" fontWeight="600" fill="#9ca3af" fontFamily="Arial,sans-serif" letterSpacing="0.8">NIGERIA</text>
  </svg>,
  /* Unilever Nigeria */
  <svg key="ulvr" height="32" viewBox="0 0 130 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="13" fill="none" stroke="#1B4DA1" strokeWidth="2"/>
    <text x="16" y="20.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1B4DA1" fontFamily="Arial,sans-serif">U</text>
    <text x="36" y="20" fontSize="13" fontWeight="700" fill="#1B4DA1" fontFamily="Arial,sans-serif" letterSpacing="-0.2">unilever</text>
    <text x="36" y="29" fontSize="7" fontWeight="500" fill="#9ca3af" fontFamily="Arial,sans-serif" letterSpacing="0.5">NIGERIA</text>
  </svg>,
  /* Honeywell Flour Mills */
  <svg key="hwl" height="32" viewBox="0 0 150 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6 L14 16 L6 26" stroke="#E87722" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="22" y="20" fontSize="13" fontWeight="800" fill="#E87722" fontFamily="Arial,sans-serif" letterSpacing="-0.2">HONEYWELL</text>
  </svg>,
  /* BUA Foods */
  <svg key="bua" height="32" viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="4" width="28" height="24" rx="4" fill="#1A1F5E"/>
    <text x="14" y="20" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff" fontFamily="Arial,sans-serif">BUA</text>
    <text x="36" y="18" fontSize="12" fontWeight="700" fill="#1A1F5E" fontFamily="Arial,sans-serif">FOODS</text>
  </svg>,
  /* Chi Limited */
  <svg key="chi" height="32" viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#CC0000"/>
    <text x="16" y="21" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="Arial,sans-serif">CHI</text>
    <text x="36" y="20" fontSize="11" fontWeight="700" fill="#CC0000" fontFamily="Arial,sans-serif">LIMITED</text>
  </svg>,
  /* UAC Foods */
  <svg key="uac" height="32" viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="6" width="30" height="20" rx="3" fill="none" stroke="#2D7D32" strokeWidth="2"/>
    <text x="15" y="20.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#2D7D32" fontFamily="Arial,sans-serif">UAC</text>
    <text x="38" y="18" fontSize="11" fontWeight="700" fill="#2D7D32" fontFamily="Arial,sans-serif">FOODS</text>
  </svg>,
  /* WACOT Rice */
  <svg key="wacot" height="32" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 24 L10 8 L16 20 L22 8 L28 24" stroke="#8B6914" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="36" y="20" fontSize="13" fontWeight="800" fill="#8B6914" fontFamily="Arial,sans-serif" letterSpacing="0.5">WACOT</text>
    <text x="36" y="29" fontSize="7.5" fontWeight="600" fill="#9ca3af" fontFamily="Arial,sans-serif" letterSpacing="0.5">RICE</text>
  </svg>,
];

/* ─── Landing Page ─── */
export function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const howItWorksRef = useInView(0.1);
  const forRolesRef = useInView(0.1);
  const statsRef = useInView(0.2);
  const faqRef = useInView(0.1);
  const ctaRef = useInView(0.15);

  const NAV_LINKS = [
    { label: 'How it works', id: 'how-it-works' },
    { label: 'For buyers', id: 'for-roles' },
    { label: 'For suppliers', id: 'for-roles' },
    { label: 'For carriers', id: 'for-roles' },
    { label: 'Pricing', id: '' },
  ];

  const scrollTo = useCallback((id: string) => {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#fff', color: '#111827', minHeight: '100vh', overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900&display=swap');

        .lp-nav-link {
          background: none; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
          color: #374151; padding: 4px 0; transition: color .15s;
        }
        .lp-nav-link:hover { color: #111; }

        .lp-btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: #111827; color: #fff; font-weight: 600; font-size: 14px;
          padding: 11px 22px; border-radius: 8px; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif; transition: background .2s;
        }
        .lp-btn-primary:hover { background: #1f2937; }

        .lp-btn-outline {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: #fff; color: #374151; font-weight: 600; font-size: 14px;
          padding: 11px 22px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer;
          font-family: 'Inter', sans-serif; transition: background .2s, border-color .2s;
        }
        .lp-btn-outline:hover { background: #f9fafb; border-color: #9ca3af; }

        .lp-role-card {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px;
          transition: box-shadow .25s;
        }
        .lp-role-card:hover { box-shadow: 0 8px 32px -8px rgba(0,0,0,.12); }

        .lp-step-card {
          background: #fff; border: 1px solid #f3f4f6; border-radius: 12px; padding: 24px;
          transition: box-shadow .25s;
        }
        .lp-step-card:hover { box-shadow: 0 8px 24px -8px rgba(0,0,0,.1); }

        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .lp-hero-text { animation: fadeUp .65s cubic-bezier(.16,1,.3,1) both; }
        .lp-hero-sub  { animation: fadeUp .65s .12s cubic-bezier(.16,1,.3,1) both; }
        .lp-hero-cta  { animation: fadeUp .65s .22s cubic-bezier(.16,1,.3,1) both; }
        .lp-hero-card { animation: fadeUp .7s .18s cubic-bezier(.16,1,.3,1) both; }
        .lp-marquee-track { display: flex; gap: 48px; animation: marquee 28s linear infinite; will-change: transform; }
        .lp-marquee-track:hover { animation-play-state: paused; }
        .lp-marquee-wrap { overflow: hidden; mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%); -webkit-mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%); }

        .lp-chip {
          display: inline-block; padding: 4px 12px; border-radius: 999px;
          font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
          background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d;
        }

        @media (max-width: 768px) {
          .lp-hide-mob { display: none !important; }
          .lp-show-mob { display: flex !important; }
          .lp-hero-grid { grid-template-columns: 1fr !important; }
          .lp-steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-roles-grid { grid-template-columns: 1fr !important; }
          .lp-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-faq-grid { grid-template-columns: 1fr !important; }
          .lp-footer-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>

      {/* ════ NAVBAR ════ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0c1e0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2C8 2 3 5 3 9a5 5 0 0010 0c0-4-5-7-5-7z" fill="#4ade80" />
                <path d="M8 6v6M5 9h6" stroke="#0c1e0e" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111', fontFamily: 'Inter, sans-serif' }}>AgriFlow</span>
          </button>

          {/* Center nav */}
          <nav className="lp-hide-mob" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {NAV_LINKS.map(l => (
              <button key={l.label} className="lp-nav-link" onClick={() => scrollTo(l.id)}>{l.label}</button>
            ))}
          </nav>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LanguageSwitcher />
            <button className="lp-nav-link lp-hide-mob" onClick={() => navigate('/login')}>Sign In</button>
            <button className="lp-btn-primary lp-hide-mob" style={{ padding: '9px 18px', fontSize: 13 }} onClick={() => navigate('/register')}>Get Started</button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#374151', display: 'none' }}
              className="lp-show-mob"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: '#fff', borderTop: '1px solid #f3f4f6', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ paddingBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
              <LanguageSwitcher />
            </div>
            {NAV_LINKS.map(l => (
              <button key={l.label} className="lp-nav-link" style={{ textAlign: 'left' }} onClick={() => scrollTo(l.id)}>{l.label}</button>
            ))}
            <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
              <button className="lp-btn-outline" style={{ flex: 1, fontSize: 13 }} onClick={() => navigate('/login')}>Sign In</button>
              <button className="lp-btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={() => navigate('/register')}>Get Started</button>
            </div>
          </div>
        )}
      </header>

      {/* ════ HERO ════ */}
      <section style={{ background: 'linear-gradient(160deg,#071a0d 0%,#0a2210 40%,#082a12 75%,#040e06 100%)', padding: '88px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Ambient orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: 480, height: 480, background: 'radial-gradient(ellipse,rgba(34,197,94,.13) 0%,transparent 68%)', borderRadius: '50%', filter: 'blur(48px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '8%', width: 380, height: 380, background: 'radial-gradient(ellipse,rgba(21,128,61,.09) 0%,transparent 68%)', borderRadius: '50%', filter: 'blur(56px)', pointerEvents: 'none' }} />

        <div className="lp-hero-grid" style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

          {/* Left: text */}
          <div>
            <h1 className="lp-hero-text" style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.08, color: '#fff', margin: '0 0 20px' }}>
              Trade produce with people you can trust.
            </h1>
            <p className="lp-hero-sub" style={{ fontSize: 16, color: 'rgba(255,255,255,.55)', lineHeight: 1.75, margin: '0 0 32px', maxWidth: 440 }}>
              AgriFlow connects verified buyers, suppliers and carriers in one place — and holds every payment until the goods arrive as agreed.
            </p>
            <div className="lp-hero-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              <button
                onClick={() => scrollTo('how-it-works')}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.85)', fontWeight: 600, fontSize: 14, padding: '11px 22px', borderRadius: 8, border: '1px solid rgba(255,255,255,.18)', cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'background .2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.14)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}
              >See how it works</button>
              <button
                onClick={() => navigate('/register')}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'background .2s', boxShadow: '0 4px 14px rgba(22,163,74,.4)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#15803d')}
                onMouseLeave={e => (e.currentTarget.style.background = '#16a34a')}
              >Create your account</button>
            </div>
            <div className="lp-hero-cta" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {['No setup fee', 'Payment held until delivery', 'Verified counterparties'].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', flexShrink: 0 }} />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right: transaction card */}
          <div className="lp-hero-card" style={{ display: 'flex', justifyContent: 'center' }}>
            <TxnCard />
          </div>
        </div>
      </section>

      {/* ════ TRUSTED BY ════ */}
      <div style={{ background: '#f9fafb', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', padding: '24px 0 20px' }}>
        <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 18px' }}>
          Trusted by 340+ businesses across Nigeria
        </p>
        <div className="lp-marquee-wrap">
          <div className="lp-marquee-track">
            {[...COMPANY_LOGOS, ...COMPANY_LOGOS].map((logo, i) => (
              <div key={i} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', height: 36, opacity: 0.72 }}>
                {logo}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════ HOW IT WORKS ════ */}
      <section id="how-it-works" style={{ background: '#fff', padding: '88px 24px' }}>
        <div ref={howItWorksRef.ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 52, opacity: howItWorksRef.visible ? 1 : 0, transform: howItWorksRef.visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s, transform .6s cubic-bezier(.16,1,.3,1)' }}>
            <div className="lp-chip" style={{ marginBottom: 16 }}>How it works</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#111', margin: '0 0 14px' }}>
              Four steps from demand to delivery.
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 520, lineHeight: 1.7, margin: 0 }}>
              Every transaction follows the same path, so both sides always know what happens next and who is responsible for it.
            </p>
          </div>
          <div className="lp-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.n} className="lp-step-card" style={{ opacity: howItWorksRef.visible ? 1 : 0, transform: howItWorksRef.visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity .55s ${i * 80}ms, transform .55s cubic-bezier(.16,1,.3,1) ${i * 80}ms` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: '.04em', marginBottom: 14 }}>{s.n}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10 }}>{s.title}</div>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ FOR EVERYONE ════ */}
      <section id="for-roles" style={{ background: '#f9fafb', padding: '88px 24px' }}>
        <div ref={forRolesRef.ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 52, opacity: forRolesRef.visible ? 1 : 0, transform: forRolesRef.visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s, transform .6s cubic-bezier(.16,1,.3,1)' }}>
            <div className="lp-chip" style={{ marginBottom: 16 }}>One platform, three sides</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#111', margin: '0 0 14px' }}>
              Built for everyone in the chain.
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 520, lineHeight: 1.7, margin: 0 }}>
              Buyers, suppliers and carriers each get their own workspace — connected to the same transaction, so nobody is left guessing.
            </p>
          </div>
          <div className="lp-roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {FOR_ROLES.map((r, i) => (
              <div key={r.label} className="lp-role-card" style={{ opacity: forRolesRef.visible ? 1 : 0, transform: forRolesRef.visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity .55s ${i * 90}ms, transform .55s cubic-bezier(.16,1,.3,1) ${i * 90}ms` }}>
                {/* Dark green square icon */}
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0c1e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2C8 2 3 5 3 9a5 5 0 0010 0c0-4-5-7-5-7z" fill="#4ade80" />
                    <path d="M8 6v6M5 9h6" stroke="#0c1e0e" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 8 }}>{r.label}</div>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65, margin: '0 0 20px' }}>{r.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {r.points.map(p => (
                    <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6b7280', display: 'inline-block', marginTop: 6, flexShrink: 0 }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ STATS ════ */}
      <section style={{ background: '#0c1e0e', padding: '64px 24px' }}>
        <div ref={statsRef.ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="lp-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {STATS.map((s, i) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '24px 20px', borderRight: i < 3 ? '1px solid rgba(255,255,255,.1)' : 'none', opacity: statsRef.visible ? 1 : 0, transform: statsRef.visible ? 'translateY(0)' : 'translateY(16px)', transition: `opacity .55s ${i * 80}ms, transform .55s cubic-bezier(.16,1,.3,1) ${i * 80}ms` }}>
                <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1 }}>
                  <CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} active={statsRef.visible} />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 10, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ TESTIMONIAL ════ */}
      <section style={{ background: '#fff', padding: '88px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 500, color: '#111', lineHeight: 1.6, margin: '0 0 36px', fontStyle: 'italic' }}>
            "We used to send half the money up front and pray. Now the payment sits with AgriFlow until my driver signs off on the load. I have not had a single argument about money since we moved across."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0c1e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#4ade80', fontWeight: 700 }}>IS</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Israel Salawu</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Procurement Lead, Kola Farms Ltd · Lagos</div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section style={{ background: '#f9fafb', padding: '88px 24px' }}>
        <div ref={faqRef.ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 52, opacity: faqRef.visible ? 1 : 0, transform: faqRef.visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s, transform .6s cubic-bezier(.16,1,.3,1)' }}>
            <div className="lp-chip" style={{ marginBottom: 16 }}>Common questions</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#111', margin: 0 }}>
              Before you sign up.
            </h2>
          </div>
          <div className="lp-faq-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, opacity: faqRef.visible ? 1 : 0, transform: faqRef.visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s .1s, transform .6s .1s cubic-bezier(.16,1,.3,1)' }}>
            {FAQ.map(f => (
              <div key={f.q} style={{ padding: '24px', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10 }}>{f.q}</div>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7, margin: 0 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ CTA ════ */}
      <section style={{ background: '#fff', padding: '64px 24px' }}>
        <div ref={ctaRef.ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 20, padding: '64px 48px', textAlign: 'center', opacity: ctaRef.visible ? 1 : 0, transform: ctaRef.visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s, transform .6s cubic-bezier(.16,1,.3,1)' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.5px', color: '#111', margin: '0 0 14px' }}>
              Start trading with the risk taken out.
            </h2>
            <p style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.7, margin: '0 0 32px' }}>
              Create your account in a few minutes. No setup fee, and nothing to pay until your first transaction completes.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="lp-btn-outline" style={{ background: '#fff' }} onClick={() => navigate('/login')}>Talk to our team</button>
              <button className="lp-btn-primary" style={{ background: '#15803d' }} onClick={() => navigate('/register')}>Create your account</button>
            </div>
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer style={{ background: '#040e06', borderTop: '1px solid rgba(255,255,255,.06)', padding: '56px 24px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="lp-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(74,222,128,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2C8 2 3 5 3 9a5 5 0 0010 0c0-4-5-7-5-7z" fill="#4ade80" />
                    <path d="M8 6v6M5 9h6" stroke="#040e06" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>AgriFlow</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.65, margin: 0, maxWidth: 240 }}>
                Agricultural trade infrastructure for Nigeria — matching, payment protection and logistics in one platform.
              </p>
            </div>

            {/* Columns */}
            {[
              { title: 'Platform', links: ['How it works', 'For buyers', 'For suppliers', 'For carriers', 'Pricing'] },
              { title: 'Company', links: ['About', 'Careers', 'Press', 'Contact'] },
              { title: 'Resources', links: ['Help centre', 'Payment protection', 'Verification', 'API documentation'] },
              { title: 'Legal', links: ['Terms of service', 'Privacy policy', 'Dispute policy'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.7)', marginBottom: 16, letterSpacing: '.03em' }}>{col.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(l => (
                    <button key={l} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,.35)', textAlign: 'left', fontFamily: 'Inter, sans-serif', padding: 0, transition: 'color .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,.8)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.35)')}
                    >{l}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', margin: 0 }}>© 2026 AgriFlow. All rights reserved.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              {['twitter', 'linkedin', 'instagram', 'facebook'].map(s => (
                <div key={s} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 12, height: 12, background: 'rgba(255,255,255,.2)', borderRadius: 2 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
