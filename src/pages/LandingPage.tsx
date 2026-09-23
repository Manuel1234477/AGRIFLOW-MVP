import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowRight, CheckCircle2, Truck, CreditCard, Search,
  ArrowRightLeft, Package, ShieldCheck, TrendingUp,
  Lock, Zap, BarChart3, Leaf, DollarSign, Clock,
  ChevronRight, Menu, X, Users, Star, Sprout,
} from 'lucide-react';
import { AgriFlowLogo } from '../components/ui/AgriFlowLogo';
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
function CountUp({ to, suffix = '', active }: { to: number; suffix?: string; active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cur = 0;
    const step = to / (1800 / 16);
    const t = setInterval(() => {
      cur += step;
      if (cur >= to) { setN(to); clearInterval(t); } else setN(Math.floor(cur));
    }, 16);
    return () => clearInterval(t);
  }, [to, active]);
  return <>{n.toLocaleString()}{suffix}</>;
}

/* ─── data ─── */
const STEPS = [
  { n: '01', icon: Search,      label: 'Discover',       desc: 'Buyers post demand. Suppliers publish verified supply listings.' },
  { n: '02', icon: CheckCircle2,label: 'Match',          desc: 'AgriFlow scores demand-supply fit by grade, qty, price & location.' },
  { n: '03', icon: ArrowRightLeft,label:'Transact',      desc: 'Buyer initiates the order. Supplier accepts the agreed terms.' },
  { n: '04', icon: CreditCard,  label: 'Escrow Pay',     desc: 'Buyer locks payment in a Soroban smart contract before logistics.' },
  { n: '05', icon: Truck,       label: 'Logistics',      desc: 'Operations assigns a verified carrier. Provider accepts the job.' },
  { n: '06', icon: Package,     label: 'Tracking',       desc: 'Carrier posts live delivery updates as the shipment moves.' },
  { n: '07', icon: ShieldCheck, label: 'Payout',         desc: 'Buyer confirms receipt. Escrow releases funds automatically.' },
];

const FEATURES = [
  { icon: Lock,      title: 'Stellar Escrow Payments',  color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  desc: 'Funds locked in a Soroban smart contract and only released on confirmed delivery — zero counterparty risk.' },
  { icon: Zap,       title: 'Intelligent Matching',      color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', desc: 'Supply and demand listings auto-scored against grade, location, quantity and price to surface the best fit instantly.' },
  { icon: BarChart3, title: 'End-to-End Visibility',    color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', desc: 'Every stakeholder — buyer, supplier, carrier, ops — sees real-time status across the entire transaction lifecycle.' },
  { icon: ShieldCheck,title:'Dispute Protection',       color: '#a855f7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)', desc: 'Evidence-based dispute resolution with objective audit logs and clear criteria for every submission.' },
  { icon: Users,     title: 'Multi-Role Workflows',     color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',  border: 'rgba(6,182,212,0.2)',  desc: 'Dedicated dashboards purpose-built for buyers, suppliers, logistics carriers, and operations teams.' },
  { icon: TrendingUp,title: 'Live Analytics',           color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  desc: 'Real-time metrics on orders, escrow balances, delivery rates, and supply-demand match velocity.' },
];

const ROLES = [
  {
    label: 'Buyer', sub: 'Commodity Purchaser', icon: DollarSign, color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)',
    points: ['Post commodity demands with exact specs', 'Browse verified, auto-matched supply', 'Pay securely via escrow — no upfront risk', 'Confirm delivery before funds release'],
  },
  {
    label: 'Supplier', sub: 'Produce & Commodity Seller', icon: Sprout, color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)',
    points: ['Publish supply with grade & certifications', 'Receive auto-matched buyer requests', 'Guaranteed payout on delivery confirmation', 'Real-time order and shipment visibility'],
  },
  {
    label: 'Logistics', sub: 'Carrier & Freight Provider', icon: Truck, color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)',
    points: ['Get assigned to shipments automatically', 'Update live delivery status from mobile', 'Transparent carrier payment on handoff', 'Integrated tracking and job dashboard'],
  },
];

/* ─── Animated Dashboard ─── */
const CYCLE_STATS = [
  [{ v:'12', ch:'+3' },{ v:'$48K', ch:'+12%' },{ v:'89', ch:'+7' },{ v:'4', ch:'-1' }],
  [{ v:'13', ch:'+4' },{ v:'$51K', ch:'+14%' },{ v:'90', ch:'+8' },{ v:'3', ch:'-2' }],
  [{ v:'14', ch:'+5' },{ v:'$53K', ch:'+11%' },{ v:'92', ch:'+9' },{ v:'3', ch:'-1' }],
  [{ v:'12', ch:'+2' },{ v:'$49K', ch:'+13%' },{ v:'91', ch:'+7' },{ v:'4', ch:'0'  }],
];
const CYCLE_ROWS = [
  ['In Transit','Delivered','Escrow','Matched'],
  ['Delivered', 'Delivered','In Transit','Escrow'],
  ['In Transit','Escrow',   'Delivered','In Transit'],
  ['Escrow',    'Delivered','Matched',  'Delivered'],
];
const LIVE_ALERTS = ['New match: Tomatoes 8 MT','Payment confirmed: TXN-0042','Delivery update: In Transit','New order: Rice 12 MT'];
const STATUS_STYLE: Record<string,{sc:string,sb:string}> = {
  'In Transit':{ sc:'#2563eb', sb:'#eff6ff' },
  'Delivered': { sc:'#16a34a', sb:'#f0fdf4' },
  'Escrow':    { sc:'#b45309', sb:'#fffbeb' },
  'Matched':   { sc:'#7c3aed', sb:'#f5f3ff' },
};

function AnimatedDashboard() {
  const [tick, setTick] = useState(0);
  const [alert, setAlert] = useState<string|null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setTick(n => n + 1);
      setAlert(LIVE_ALERTS[Math.floor(Math.random() * LIVE_ALERTS.length)]);
      const clear = setTimeout(() => setAlert(null), 2400);
      return () => clearTimeout(clear);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const si = tick % CYCLE_STATS.length;
  const ri = tick % CYCLE_ROWS.length;
  const stats = CYCLE_STATS[si];
  const rowStatuses = CYCLE_ROWS[ri];

  const statDefs = [
    { label:'Active Orders', icon:Package,      c:'#22c55e', bg:'#f0fdf4', bd:'#bbf7d0' },
    { label:'In Escrow',     icon:Lock,          c:'#3b82f6', bg:'#eff6ff', bd:'#bfdbfe' },
    { label:'Delivered',     icon:CheckCircle2,  c:'#10b981', bg:'#f0fdf4', bd:'#a7f3d0' },
    { label:'Pending',       icon:Clock,         c:'#f59e0b', bg:'#fffbeb', bd:'#fde68a' },
  ];
  const rows = [
    { id:'TXN-0041', item:'Yellow Maize',  qty:'50 MT',  val:'$18,500' },
    { id:'TXN-0039', item:'Soybean',       qty:'20 MT',  val:'$12,200' },
    { id:'TXN-0037', item:'Groundnut',     qty:'30 MT',  val:'$9,400'  },
    { id:'TXN-0035', item:'Rice (Local)',   qty:'15 MT',  val:'$6,700'  },
  ];

  return (
    <div style={{ borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,.1)', background:'#0d1117', boxShadow:'0 40px 80px -20px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.05)' }}>
      {/* Chrome bar */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:'#161b22', borderBottom:'1px solid rgba(255,255,255,.06)', position:'relative' }}>
        <span style={{ width:12, height:12, borderRadius:'50%', background:'#ff5f57', display:'inline-block' }}/>
        <span style={{ width:12, height:12, borderRadius:'50%', background:'#febc2e', display:'inline-block' }}/>
        <span style={{ width:12, height:12, borderRadius:'50%', background:'#28c840', display:'inline-block' }}/>
        <div style={{ marginLeft:10, flex:1, maxWidth:260, height:20, borderRadius:6, background:'rgba(255,255,255,.05)', display:'flex', alignItems:'center', padding:'0 10px' }}>
          <span style={{ fontSize:10, color:'rgba(255,255,255,.2)', fontFamily:'monospace' }}>agriflow.app/dashboard</span>
        </div>
        {alert && (
          <div key={alert} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:9, color:'#4ade80', background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.25)', borderRadius:999, padding:'2px 10px', whiteSpace:'nowrap', animation:'liveAlert 2.4s ease forwards' }}>
            ✦ {alert}
          </div>
        )}
      </div>

      {/* Layout */}
      <div style={{ display:'flex', height:360 }}>
        {/* Sidebar */}
        <div style={{ width:180, background:'#0d1a10', borderRight:'1px solid rgba(255,255,255,.06)', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'#22c55e', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Leaf size={14} color="#052e16"/>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#fff', lineHeight:1 }}>AgriFlow</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.3)', marginTop:2 }}>Trade Platform</div>
            </div>
          </div>
          <nav style={{ flex:1, padding:'10px 8px', display:'flex', flexDirection:'column', gap:2 }}>
            {[
              { icon:BarChart3,       label:'Dashboard',    active:true  },
              { icon:Package,        label:'Supply',       active:false },
              { icon:Search,         label:'Discover',     active:false },
              { icon:ArrowRightLeft, label:'Transactions', active:false },
              { icon:Truck,          label:'Logistics',    active:false },
            ].map(({ icon:Icon, label, active }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, fontSize:12, fontWeight:500, color:active?'#22c55e':'rgba(255,255,255,.3)', background:active?'rgba(34,197,94,.1)':'transparent', borderLeft:`2px solid ${active?'#22c55e':'transparent'}` }}>
                <Icon size={13}/>{label}
              </div>
            ))}
          </nav>
          <div style={{ padding:'12px 14px', borderTop:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#22c55e' }}>JD</div>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'#fff' }}>John Doe</div>
              <div style={{ fontSize:9, color:'#22c55e' }}>Buyer · Verified</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, background:'#f0f2f0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Topbar */}
          <div style={{ padding:'10px 18px', background:'#fff', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#111' }}>Buyer Dashboard</div>
              <div style={{ fontSize:10, color:'#9ca3af' }}>September 2026</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#16a34a', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:999, padding:'3px 10px', display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'dotPulse 1.4s infinite' }}/>
                Live
              </div>
              <div style={{ width:28, height:28, borderRadius:8, background:'#f9fafb', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <TrendingUp size={13} color="#22c55e"/>
              </div>
            </div>
          </div>

          <div style={{ flex:1, padding:'14px', display:'flex', flexDirection:'column', gap:12, overflow:'hidden' }}>
            {/* Stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {statDefs.map((s, idx) => (
                <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.bd}`, borderRadius:10, padding:'10px 12px', transition:'all .4s ease' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <s.icon size={13} color={s.c}/>
                    <span style={{ fontSize:9, fontWeight:700, color:s.c, transition:'all .3s' }}>{stats[idx].ch}</span>
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#111', lineHeight:1, transition:'all .3s' }}>{stats[idx].v}</div>
                  <div style={{ fontSize:9, color:'#6b7280', marginTop:3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{ flex:1, background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <div style={{ padding:'8px 14px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#111' }}>Recent Transactions</span>
                <span style={{ fontSize:10, color:'#16a34a', fontWeight:600 }}>View all →</span>
              </div>
              {rows.map((r, idx) => {
                const st = rowStatuses[idx];
                const { sc, sb } = STATUS_STYLE[st] ?? STATUS_STYLE['Matched'];
                return (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 14px', borderBottom:'1px solid #f9fafb' }}>
                    <span style={{ fontSize:9, fontFamily:'monospace', color:'#9ca3af', flexShrink:0 }}>{r.id}</span>
                    <span style={{ flex:1, fontSize:10, fontWeight:600, color:'#111' }}>{r.item}</span>
                    <span style={{ fontSize:9, color:'#9ca3af' }}>{r.qty}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:'#111', width:52, textAlign:'right' }}>{r.val}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:sc, background:sb, padding:'2px 8px', borderRadius:999, transition:'all .4s ease', minWidth:60, textAlign:'center' }}>{st}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Product Slideshow ─── */
const SLIDES = [
  {
    badge: 'Connected Commerce',
    title: 'From Farm Gate to Final Buyer — One Platform',
    desc: 'Eliminate fragmented calls, spreadsheets, and manual matching. Every party on a single transparent system.',
    points: ['Verified supply and demand listings','Auto-scored commodity matching','Real-time inventory visibility'],
    color: '#22c55e', accent: '#166534',
    visual: (
      <svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
        <rect width="360" height="220" rx="16" fill="url(#sg1)"/>
        <defs>
          <linearGradient id="sg1" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f0fdf4"/><stop offset="1" stopColor="#dcfce7"/>
          </linearGradient>
        </defs>
        {/* Flow path */}
        <path d="M 40 110 Q 120 60 180 110 Q 240 160 320 110" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="7 4" fill="none" opacity=".6"/>
        {/* Farm node */}
        <circle cx="40" cy="110" r="32" fill="#fff" stroke="#bbf7d0" strokeWidth="1.5"/>
        <text x="40" y="103" textAnchor="middle" fontSize="18">🌾</text>
        <text x="40" y="118" textAnchor="middle" fontSize="8" fontWeight="700" fill="#166534">FARM</text>
        {/* Warehouse node */}
        <circle cx="180" cy="110" r="32" fill="#fff" stroke="#bbf7d0" strokeWidth="1.5"/>
        <text x="180" y="103" textAnchor="middle" fontSize="18">🏭</text>
        <text x="180" y="118" textAnchor="middle" fontSize="8" fontWeight="700" fill="#166534">SUPPLIER</text>
        {/* Market node */}
        <circle cx="320" cy="110" r="32" fill="#fff" stroke="#bbf7d0" strokeWidth="1.5"/>
        <text x="320" y="103" textAnchor="middle" fontSize="18">🛒</text>
        <text x="320" y="118" textAnchor="middle" fontSize="8" fontWeight="700" fill="#166534">BUYER</text>
        {/* Truck */}
        <circle cx="110" cy="80" r="16" fill="#22c55e" opacity=".12"/>
        <text x="110" y="85" textAnchor="middle" fontSize="13">🚛</text>
        {/* Match badge */}
        <rect x="148" y="148" width="64" height="20" rx="10" fill="#15803d"/>
        <text x="180" y="161" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">✓ Matched</text>
        {/* Commodity tags */}
        <rect x="8" y="156" width="60" height="14" rx="7" fill="#dcfce7" stroke="#bbf7d0"/>
        <text x="38" y="166" textAnchor="middle" fontSize="8" fill="#15803d" fontWeight="600">Yellow Maize</text>
        <rect x="288" y="156" width="60" height="14" rx="7" fill="#dcfce7" stroke="#bbf7d0"/>
        <text x="318" y="166" textAnchor="middle" fontSize="8" fill="#15803d" fontWeight="600">Soybean</text>
      </svg>
    ),
  },
  {
    badge: 'Secure Payments',
    title: 'Zero Counterparty Risk with Stellar Escrow',
    desc: 'Funds locked in a Soroban smart contract, released only on delivery confirmation — protecting every party.',
    points: ['Stellar blockchain smart contract','Funds released on buyer confirmation','Instant automated payout'],
    color: '#3b82f6', accent: '#1d4ed8',
    visual: (
      <svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
        <rect width="360" height="220" rx="16" fill="url(#sg2)"/>
        <defs>
          <linearGradient id="sg2" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">
            <stop stopColor="#eff6ff"/><stop offset="1" stopColor="#dbeafe"/>
          </linearGradient>
        </defs>
        {/* Buyer */}
        <rect x="20" y="75" width="80" height="70" rx="12" fill="#fff" stroke="#bfdbfe" strokeWidth="1.5"/>
        <text x="60" y="105" textAnchor="middle" fontSize="18">👤</text>
        <text x="60" y="120" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1d4ed8">BUYER</text>
        <text x="60" y="132" textAnchor="middle" fontSize="7" fill="#3b82f6">Locks payment</text>
        {/* Escrow shield */}
        <rect x="130" y="55" width="100" height="110" rx="16" fill="#1d4ed8" opacity=".08" stroke="#3b82f6" strokeWidth="1.5"/>
        <text x="180" y="100" textAnchor="middle" fontSize="26">🔐</text>
        <text x="180" y="118" textAnchor="middle" fontSize="9" fontWeight="800" fill="#1d4ed8">ESCROW</text>
        <text x="180" y="130" textAnchor="middle" fontSize="8" fill="#3b82f6">Smart Contract</text>
        <rect x="148" y="140" width="64" height="15" rx="7" fill="#3b82f6"/>
        <text x="180" y="151" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">XLM Stellar</text>
        {/* Supplier */}
        <rect x="260" y="75" width="80" height="70" rx="12" fill="#fff" stroke="#bfdbfe" strokeWidth="1.5"/>
        <text x="300" y="105" textAnchor="middle" fontSize="18">🌱</text>
        <text x="300" y="120" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1d4ed8">SUPPLIER</text>
        <text x="300" y="132" textAnchor="middle" fontSize="7" fill="#3b82f6">Receives payout</text>
        {/* Arrows */}
        <path d="M 100 110 L 130 110" stroke="#3b82f6" strokeWidth="1.5" markerEnd="url(#arr)"/>
        <path d="M 230 110 L 260 110" stroke="#3b82f6" strokeWidth="1.5" markerEnd="url(#arr)"/>
        <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M 0 1 L 5 4 L 0 7 Z" fill="#3b82f6"/></marker></defs>
        {/* Confirmation badge */}
        <rect x="130" y="178" width="100" height="16" rx="8" fill="#22c55e"/>
        <text x="180" y="189" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">✓ Delivered · Payout Released</text>
      </svg>
    ),
  },
  {
    badge: 'Live Tracking',
    title: 'Track Every Shipment From Loading to Delivery',
    desc: 'Real-time status updates, carrier milestones, and instant notifications keep every stakeholder informed.',
    points: ['Live carrier status updates','Milestone-based notifications','Dispute-ready audit logs'],
    color: '#f59e0b', accent: '#b45309',
    visual: (
      <svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
        <rect width="360" height="220" rx="16" fill="url(#sg3)"/>
        <defs>
          <linearGradient id="sg3" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fffbeb"/><stop offset="1" stopColor="#fef3c7"/>
          </linearGradient>
        </defs>
        {/* Route path */}
        <path d="M 30 160 Q 100 80 180 130 Q 260 180 330 80" stroke="#f59e0b" strokeWidth="3" strokeDasharray="8 5" fill="none"/>
        {/* Milestone stops */}
        {[30,110,190,270,330].map((x,i) => {
          const ys = [160,95,140,155,80];
          const labels = ['Loading','Checkpoint 1','En Route','Checkpoint 2','Delivered'];
          const done = i < 3;
          return (
            <g key={i}>
              <circle cx={x} cy={ys[i]} r={10} fill={done?'#f59e0b':'#fff'} stroke={done?'#f59e0b':'#fbbf24'} strokeWidth="1.5"/>
              {done && <text x={x} y={ys[i]+4} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="800">✓</text>}
              <text x={x} y={ys[i]+22} textAnchor="middle" fontSize="7" fill={done?'#b45309':'#9ca3af'} fontWeight={done?'700':'400'}>{labels[i]}</text>
            </g>
          );
        })}
        {/* Truck marker at position 3 */}
        <circle cx="190" cy="128" r="18" fill="#f59e0b" opacity=".15"/>
        <text x="190" y="133" textAnchor="middle" fontSize="16">🚛</text>
        {/* Status badge */}
        <rect x="130" y="185" width="100" height="18" rx="9" fill="#f59e0b"/>
        <text x="180" y="197" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">● In Transit — 68% complete</text>
        {/* ETA badge */}
        <rect x="255" y="48" width="70" height="22" rx="11" fill="#fff" stroke="#fbbf24"/>
        <text x="290" y="62" textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="700">ETA: 2h 15m</text>
      </svg>
    ),
  },
  {
    badge: 'Data & Analytics',
    title: 'Real-Time Insights for Smarter Trade Decisions',
    desc: 'Live dashboards give buyers, suppliers, and operations teams metrics to scale their agri-business confidently.',
    points: ['Live escrow and order metrics','Delivery rate analytics','Supply-demand trend insights'],
    color: '#a855f7', accent: '#7c3aed',
    visual: (
      <svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
        <rect width="360" height="220" rx="16" fill="url(#sg4)"/>
        <defs>
          <linearGradient id="sg4" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">
            <stop stopColor="#faf5ff"/><stop offset="1" stopColor="#ede9fe"/>
          </linearGradient>
        </defs>
        {/* Bar chart */}
        {[
          { x:30, h:60, c:'#a855f7' },{ x:70, h:90, c:'#7c3aed' },{ x:110, h:50, c:'#a855f7' },
          { x:150, h:110, c:'#7c3aed' },{ x:190, h:75, c:'#a855f7' },{ x:230, h:130, c:'#7c3aed' },
        ].map((b,i) => (
          <rect key={i} x={b.x} y={170-b.h} width="26" height={b.h} rx="5" fill={b.c} opacity=".8"/>
        ))}
        <line x1="20" y1="170" x2="270" y2="170" stroke="#d8b4fe" strokeWidth="1"/>
        {/* Trend line */}
        <path d="M 43 150 L 83 125 L 123 140 L 163 95 L 203 115 L 243 75" stroke="#22c55e" strokeWidth="2.5" fill="none"/>
        <circle cx="243" cy="75" r="5" fill="#22c55e"/>
        {/* Stat cards */}
        <rect x="285" y="30" width="65" height="50" rx="10" fill="#fff" stroke="#e9d5ff" strokeWidth="1"/>
        <text x="317" y="52" textAnchor="middle" fontSize="16" fontWeight="900" fill="#7c3aed">98%</text>
        <text x="317" y="66" textAnchor="middle" fontSize="8" fill="#9ca3af">Escrow rate</text>
        <rect x="285" y="90" width="65" height="50" rx="10" fill="#fff" stroke="#e9d5ff" strokeWidth="1"/>
        <text x="317" y="112" textAnchor="middle" fontSize="16" fontWeight="900" fill="#22c55e">2.4K</text>
        <text x="317" y="126" textAnchor="middle" fontSize="8" fill="#9ca3af">Listings</text>
        <rect x="285" y="150" width="65" height="50" rx="10" fill="#fff" stroke="#e9d5ff" strokeWidth="1"/>
        <text x="317" y="172" textAnchor="middle" fontSize="16" fontWeight="900" fill="#f59e0b">18h</text>
        <text x="317" y="186" textAnchor="middle" fontSize="8" fill="#9ca3af">Avg match</text>
        {/* Chart label */}
        <text x="145" y="195" textAnchor="middle" fontSize="8" fill="#9ca3af">Monthly order volume (MT)</text>
      </svg>
    ),
  },
];

function ProductSlideshow() {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<'next'|'prev'>('next');
  const total = SLIDES.length;

  useEffect(() => {
    const t = setInterval(() => { setDir('next'); setIdx(i => (i + 1) % total); }, 5000);
    return () => clearInterval(t);
  }, [total]);

  const go = (next: number, d: 'next'|'prev') => { setDir(d); setIdx((next + total) % total); };
  const s = SLIDES[idx];

  return (
    <section style={{ background:'#fff', padding:'72px 24px' }}>
      <div style={{ maxWidth:1140, margin:'0 auto' }}>
        {/* Heading */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div className="pill" style={{ marginBottom:16 }}>Platform Highlights</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, letterSpacing:'-1.5px', color:'#111', margin:0 }}>
            See AgriFlow in action.
          </h2>
        </div>

        {/* Slide */}
        <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'center', animation:`${dir==='next'?'slideNext':'slidePrev'} .5s cubic-bezier(.16,1,.3,1) both` }} className="slideshow-grid">
          {/* Text */}
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:999, fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:s.accent, background:`${s.color}18`, border:`1px solid ${s.color}33`, marginBottom:18 }}>
              {s.badge}
            </div>
            <h3 style={{ fontSize:'clamp(22px,3vw,32px)', fontWeight:900, letterSpacing:'-1px', lineHeight:1.15, color:'#111', margin:'0 0 14px' }}>{s.title}</h3>
            <p style={{ fontSize:14, color:'#6b7280', lineHeight:1.75, margin:'0 0 22px' }}>{s.desc}</p>
            <ul style={{ listStyle:'none', padding:0, margin:'0 0 28px', display:'flex', flexDirection:'column', gap:10 }}>
              {s.points.map(p => (
                <li key={p} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:'#374151' }}>
                  <span style={{ width:18, height:18, borderRadius:'50%', background:`${s.color}18`, border:`1px solid ${s.color}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <CheckCircle2 size={10} color={s.accent}/>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            {/* Dot nav */}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ display:'flex', gap:6 }}>
                {SLIDES.map((_, i) => (
                  <button key={i} onClick={() => go(i, i > idx ? 'next' : 'prev')} style={{ width: i === idx ? 24 : 8, height:8, borderRadius:999, border:'none', cursor:'pointer', background: i === idx ? s.color : '#e5e7eb', transition:'all .3s ease', padding:0 }}/>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, marginLeft:8 }}>
                <button onClick={() => go(idx - 1, 'prev')} style={{ width:30, height:30, borderRadius:'50%', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }} onMouseEnter={e=>(e.currentTarget.style.background='#f9fafb')} onMouseLeave={e=>(e.currentTarget.style.background='#fff')}>
                  <ChevronRight size={14} style={{ transform:'rotate(180deg)', color:'#6b7280' }}/>
                </button>
                <button onClick={() => go(idx + 1, 'next')} style={{ width:30, height:30, borderRadius:'50%', border:'none', background:s.color, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}>
                  <ChevronRight size={14} style={{ color:'#fff' }}/>
                </button>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div style={{ borderRadius:20, overflow:'hidden', boxShadow:'0 20px 48px -12px rgba(0,0,0,.12)', border:'1px solid #f3f4f6', aspectRatio:'360/220', background:'#f9fafb' }}>
            {s.visual}
          </div>
        </div>
      </div>
      <style>{`.slideshow-grid { @media(max-width:768px){grid-template-columns:1fr!important;} }`}</style>
    </section>
  );
}

/* ─── Landing Page ─── */
export function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const statsIn  = useInView(0.25);
  const stepsIn  = useInView(0.05);
  const featIn   = useInView(0.05);
  const rolesIn  = useInView(0.05);
  const ctaIn    = useInView(0.15);

  const onScroll = useCallback(() => setScrolled(window.scrollY > 24), []);
  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#fff', color: '#111827', minHeight: '100vh', overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400&display=swap');

        @keyframes fadeUp   { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes floatY   { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-16px) rotate(.8deg)} }
        @keyframes orb      { 0%,100%{transform:translate(0,0) scale(1);opacity:.55} 40%{transform:translate(28px,-22px) scale(1.07);opacity:.8} 70%{transform:translate(-18px,14px) scale(.94);opacity:.6} }
        @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes dotPulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes slideIn   { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideNext { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slidePrev { from{opacity:0;transform:translateX(-32px)} to{opacity:1;transform:translateX(0)} }
        @keyframes liveAlert { 0%{opacity:0;transform:translateY(-4px)} 10%{opacity:1;transform:translateY(0)} 85%{opacity:1} 100%{opacity:0} }

        .fu  { animation: fadeUp  .7s cubic-bezier(.16,1,.3,1) both }
        .fi  { animation: fadeIn  .6s ease both }
        .d1  { animation-delay:.07s }
        .d2  { animation-delay:.14s }
        .d3  { animation-delay:.21s }
        .d4  { animation-delay:.28s }
        .d5  { animation-delay:.36s }
        .d6  { animation-delay:.45s }

        .shimmer-text {
          background: linear-gradient(90deg,#15803d,#22c55e,#4ade80,#22c55e,#15803d);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s linear infinite;
        }

        .mockup-tilt {
          transform: perspective(1200px) rotateX(4deg) rotateY(-2deg);
          transition: transform .55s cubic-bezier(.16,1,.3,1);
        }
        .mockup-tilt:hover { transform: perspective(1200px) rotateX(1deg) rotateY(0deg); }

        .feature-card {
          background: #fff;
          border: 1px solid #f3f4f6;
          border-radius: 16px;
          padding: 28px;
          transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease;
        }
        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px -12px rgba(0,0,0,0.1);
          border-color: #e5e7eb;
        }

        .step-card {
          background: #fff;
          border: 1px solid #f3f4f6;
          border-radius: 14px;
          padding: 20px 16px;
          text-align: center;
          transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease;
        }
        .step-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 32px -8px rgba(0,0,0,0.1);
          border-color: #d1fae5;
        }
        .step-card:hover .step-icon { background: #15803d !important; border-color: #15803d !important; color: #fff !important; }

        .role-card {
          background: #fff;
          border: 1px solid #f3f4f6;
          border-radius: 18px;
          padding: 32px;
          display: flex; flex-direction: column;
          transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease;
        }
        .role-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px -12px rgba(0,0,0,0.1); border-color: #e5e7eb; }

        .pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 14px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
          background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d;
        }

        .cta-btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: #15803d; color: #fff; font-weight: 700; font-size: 14px;
          padding: 13px 26px; border-radius: 10px; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background .2s, transform .2s, box-shadow .2s;
          box-shadow: 0 4px 14px rgba(21,128,61,.35);
        }
        .cta-btn-primary:hover { background: #166534; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(21,128,61,.45); }

        .cta-btn-ghost {
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
          background: transparent; color: #374151; font-weight: 600; font-size: 14px;
          padding: 13px 26px; border-radius: 10px; border: 1px solid #d1d5db; cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background .2s, border-color .2s, transform .2s;
        }
        .cta-btn-ghost:hover { background: #f9fafb; border-color: #9ca3af; transform: translateY(-2px); }

        @media (max-width: 768px) {
          .hide-mob { display: none !important; }
          .show-mob { display: block !important; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: repeat(2,1fr) !important; }
          .roles-grid { grid-template-columns: 1fr !important; }
          .hero-h1 { font-size: clamp(38px,9vw,56px) !important; }
        }
      `}</style>

      {/* ════ NAV ════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 60,
        background: scrolled ? 'rgba(255,255,255,.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,.07)' : '1px solid transparent',
        transition: 'all .3s ease',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <AgriFlowLogo size="md" />
          <nav className="hide-mob" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {['How It Works', 'Features', "Who It's For"].map((t) => (
              <button key={t} style={{ background: 'none', border: 'none', fontSize: 14, color: scrolled ? '#374151' : 'rgba(255,255,255,.7)', fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = scrolled ? '#111' : '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = scrolled ? '#374151' : 'rgba(255,255,255,.7)')}
              >{t}</button>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="hide-mob">
              <LanguageSwitcher variant={scrolled ? 'dark' : 'light'} />
            </div>
            <button className="cta-btn-ghost hide-mob" style={{ padding: '7px 18px', fontSize: 13, color: scrolled ? '#374151' : 'rgba(255,255,255,.75)', borderColor: scrolled ? '#d1d5db' : 'rgba(255,255,255,.25)', background: scrolled ? 'transparent' : 'rgba(255,255,255,.08)' }} onClick={() => navigate('/login')}>Sign In</button>
            <button className="cta-btn-primary" style={{ padding: '7px 18px', fontSize: 13 }} onClick={() => navigate('/register')}>Create Account</button>
            <button className="show-mob" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: scrolled ? '#374151' : '#fff', padding: 4 }} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div style={{ background: '#fff', borderTop: '1px solid #f3f4f6', padding: '14px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['How It Works', 'Features', "Who It's For"].map(t => (
              <button key={t} onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#374151', fontSize: 14, fontWeight: 500, textAlign: 'left', cursor: 'pointer', fontFamily: "'Inter',sans-serif", padding: '4px 0' }}>{t}</button>
            ))}
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <button className="cta-btn-ghost" style={{ flex: 1, padding: 10, fontSize: 13 }} onClick={() => navigate('/login')}>Sign In</button>
              <button className="cta-btn-primary" style={{ flex: 1, padding: 10, fontSize: 13 }} onClick={() => navigate('/register')}>Get Started</button>
            </div>
          </div>
        )}
      </header>

      {/* ════ HERO ════ */}
      <section style={{ position: 'relative', minHeight: '100vh', background: 'linear-gradient(160deg,#071a0d 0%,#0a2210 35%,#082a12 70%,#040e06 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '90px 24px 70px', overflow: 'hidden' }}>
        {/* Ambient orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: 520, height: 520, background: 'radial-gradient(ellipse,rgba(34,197,94,.14) 0%,transparent 68%)', borderRadius: '50%', filter: 'blur(40px)', animation: 'orb 13s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 440, height: 440, background: 'radial-gradient(ellipse,rgba(21,128,61,.1) 0%,transparent 68%)', borderRadius: '50%', filter: 'blur(50px)', animation: 'orb 17s ease-in-out infinite reverse', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', right: '30%', width: 280, height: 280, background: 'radial-gradient(ellipse,rgba(74,222,128,.07) 0%,transparent 70%)', borderRadius: '50%', filter: 'blur(30px)', animation: 'orb 10s ease-in-out infinite', animationDelay: '-4s', pointerEvents: 'none' }} />

        <div ref={heroRef} style={{ position: 'relative', maxWidth: 880, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, textAlign: 'center' }}>
          {/* Badge */}
          {heroVisible && (
            <div className="fu" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', background: 'rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 999, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.7)', backdropFilter: 'blur(8px)', cursor: 'default' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'dotPulse 1.6s ease-in-out infinite' }} />
              Agricultural Commerce &amp; Secured Escrow Logistics
              <ChevronRight size={12} style={{ opacity: .5 }} />
            </div>
          )}

          {/* Headline */}
          {heroVisible && (
            <div className="fu d1">
              <h1 className="hero-h1" style={{ fontSize: 'clamp(44px,6.5vw,72px)', fontWeight: 900, letterSpacing: '-2.5px', lineHeight: 1.04, margin: 0, color: '#fff' }}>
                Move agricultural commerce<br />
                <span className="shimmer-text">from fragmented to connected.</span>
              </h1>
            </div>
          )}

          {/* Sub */}
          {heroVisible && (
            <p className="fu d2" style={{ fontSize: 17, color: 'rgba(255,255,255,.45)', maxWidth: 560, lineHeight: 1.75, margin: 0, fontWeight: 400 }}>
              AgriFlow coordinates the complete transaction between buyers, suppliers, logistics carriers, and operations — from commodity discovery to verified delivery and automated escrow payout.
            </p>
          )}

          {/* CTAs */}
          {heroVisible && (
            <div className="fu d3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="cta-btn-primary" onClick={() => navigate('/login')}>
                Access Platform <ArrowRight size={15} />
              </button>
              <button className="cta-btn-ghost" style={{ color: 'rgba(255,255,255,.65)', borderColor: 'rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)'; e.currentTarget.style.color = 'rgba(255,255,255,.65)'; }}
                onClick={() => navigate('/register')}>
                Create Free Account
              </button>
            </div>
          )}

          {/* Stars */}
          {heroVisible && (
            <div className="fu d4" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[1,2,3,4,5].map(i => <Star key={i} size={13} fill="#f59e0b" color="#f59e0b" />)}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', fontWeight: 500, marginLeft: 4 }}>Trusted by agri-trade teams across Africa</span>
            </div>
          )}

          {/* Dashboard */}
          {heroVisible && (
            <div className="fu d5" style={{ width: '100%', maxWidth: 860, animation: 'floatY 7s ease-in-out infinite' }}>
              <div className="mockup-tilt">
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: -24, background: 'radial-gradient(ellipse,rgba(34,197,94,.1) 0%,transparent 65%)', borderRadius: 24, filter: 'blur(20px)' }} />
                  <div style={{ position: 'relative' }}>
                    <AnimatedDashboard />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fade to white */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to top,#fff,transparent)', pointerEvents: 'none' }} />
      </section>

      {/* ════ STATS ════ */}
      <section style={{ background: '#fff', padding: '64px 24px' }}>
        <div ref={statsIn.ref} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              { to: 2400, suffix: '+', label: 'Active Listings',      sub: 'updated daily' },
              { to: 98,   suffix: '%', label: 'Escrow Release Rate',  sub: 'on confirmed delivery' },
              { to: 340,  suffix: '+', label: 'Verified Suppliers',   sub: 'across the network' },
              { to: 18,   suffix: 'h', label: 'Avg. Match Time',      sub: 'demand to supply' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '28px 20px', background: '#f9fafb', borderRadius: 16, border: '1px solid #f3f4f6', opacity: statsIn.visible ? 1 : 0, transform: statsIn.visible ? 'translateY(0)' : 'translateY(20px)', transition: `opacity .6s ${i * 80}ms, transform .6s cubic-bezier(.16,1,.3,1) ${i * 80}ms` }}>
                <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1.5px', color: '#111', lineHeight: 1 }}>
                  <CountUp to={s.to} suffix={s.suffix} active={statsIn.visible} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginTop: 8 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ PRODUCT SLIDESHOW ════ */}
      <ProductSlideshow />

      {/* ════ HOW IT WORKS ════ */}
      <section style={{ background: '#f9fafb', padding: '88px 24px' }}>
        <div ref={stepsIn.ref} style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52, opacity: stepsIn.visible ? 1 : 0, transform: stepsIn.visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s, transform .6s cubic-bezier(.16,1,.3,1)' }}>
            <div className="pill" style={{ marginBottom: 18 }}>Transaction Flow</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 14px', color: '#111' }}>
              One complete trade loop, end to end.
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
              Every transaction is verified, escrow-secured, tracked, and confirmed — from discovery to automated payout.
            </p>
          </div>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10 }}>
            {STEPS.map((s, i) => (
              <div key={s.label} className="step-card" style={{ opacity: stepsIn.visible ? 1 : 0, transform: stepsIn.visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity .55s ${i * 55}ms, transform .55s cubic-bezier(.16,1,.3,1) ${i * 55}ms` }}>
                <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 14 }}>
                  <div className="step-icon" style={{ width: 38, height: 38, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d', transition: 'all .25s' }}>
                    <s.icon size={16} />
                  </div>
                  <span style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#111', color: '#fff', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#111', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>{s.label}</div>
                <p style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ FEATURES ════ */}
      <section style={{ background: '#fff', padding: '88px 24px' }}>
        <div ref={featIn.ref} style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52, opacity: featIn.visible ? 1 : 0, transform: featIn.visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s, transform .6s cubic-bezier(.16,1,.3,1)' }}>
            <div className="pill" style={{ marginBottom: 18 }}>Platform Capabilities</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 14px', color: '#111' }}>
              Built for trust at every step.
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
              Purpose-built to eliminate the friction, fraud, and fragmentation holding agricultural commerce back.
            </p>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="feature-card" style={{ opacity: featIn.visible ? 1 : 0, transform: featIn.visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity .55s ${i * 70}ms, transform .55s cubic-bezier(.16,1,.3,1) ${i * 70}ms` }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: f.bg, border: `1px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <f.icon size={19} color={f.color} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: '-.3px', marginBottom: 10 }}>{f.title}</div>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ ROLES ════ */}
      <section style={{ background: '#f9fafb', padding: '88px 24px' }}>
        <div ref={rolesIn.ref} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52, opacity: rolesIn.visible ? 1 : 0, transform: rolesIn.visible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s, transform .6s cubic-bezier(.16,1,.3,1)' }}>
            <div className="pill" style={{ marginBottom: 18 }}>Stakeholders</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 14px', color: '#111' }}>
              Designed for every role in the supply chain.
            </h2>
            <p style={{ fontSize: 15, color: '#6b7280', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
              Whether you buy, supply, or move goods — AgriFlow has a dedicated workflow for your role.
            </p>
          </div>
          <div className="roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {ROLES.map((r, i) => (
              <div key={r.label} className="role-card" style={{ opacity: rolesIn.visible ? 1 : 0, transform: rolesIn.visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity .55s ${i * 90}ms, transform .55s cubic-bezier(.16,1,.3,1) ${i * 90}ms` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-.6px', color: '#111' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, fontWeight: 500 }}>{r.sub}</div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: r.bg, border: `1px solid ${r.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <r.icon size={20} color={r.color} />
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
                  {r.points.map(p => (
                    <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: '#4b5563', lineHeight: 1.55 }}>
                      <CheckCircle2 size={14} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
                      {p}
                    </li>
                  ))}
                </ul>
                <button className="cta-btn-ghost" style={{ width: '100%', fontSize: 13 }} onClick={() => navigate('/register')}>
                  Join as {r.label} <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ CTA ════ */}
      <section ref={ctaIn.ref} style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#071a0d 0%,#0a2210 40%,#040e06 100%)', padding: '100px 24px' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(ellipse,rgba(34,197,94,.12) 0%,transparent 65%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto', textAlign: 'center', opacity: ctaIn.visible ? 1 : 0, transform: ctaIn.visible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity .7s, transform .7s cubic-bezier(.16,1,.3,1)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', background: 'rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 999, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.6)', backdropFilter: 'blur(8px)', marginBottom: 26 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'dotPulse 1.6s ease-in-out infinite' }} />
            Start free · No credit card required
          </div>
          <h2 style={{ fontSize: 'clamp(32px,5vw,54px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.05, color: '#fff', margin: '0 0 18px' }}>
            Move your agricultural<br />
            <span className="shimmer-text">trade forward today.</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.4)', maxWidth: 460, margin: '0 auto 34px', lineHeight: 1.75 }}>
            Join the platform that brings buyers, suppliers, and carriers together under one transparent, escrow-secured system.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="cta-btn-primary" onClick={() => navigate('/register')}>
              Create Free Account <ArrowRight size={15} />
            </button>
            <button className="cta-btn-ghost" style={{ color: 'rgba(255,255,255,.65)', borderColor: 'rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
              onClick={() => navigate('/login')}>
              Sign In to Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer style={{ background: '#040e06', borderTop: '1px solid rgba(255,255,255,.06)', padding: '36px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <AgriFlowLogo size="sm" variant="white" showSubtitle />
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {['Privacy', 'Terms', 'Contact', 'About'].map(l => (
                <button key={l} style={{ background: 'none', border: 'none', fontSize: 12, color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'color .2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,.6)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.25)')}
                >{l}</button>
              ))}
            </div>
          </div>
          <div style={{ paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.18)', margin: 0 }}>© 2026 AgriFlow. All rights reserved. Trade securely across agricultural value chains.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'dotPulse 1.6s ease-in-out infinite' }} />
              <span style={{ fontSize: 11, color: 'rgba(34,197,94,.55)', fontWeight: 600 }}>Platform Live</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
