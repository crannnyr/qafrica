// src/pages/recommendations/AnnouncementBanner.tsx
// Header announcement strip: a 3D tumbling shipping-box icon + rotating
// promotional messages. Sits above the Jumia promo bar.
export default function AnnouncementBanner() {
  return (
    <>
      <style>{`
        .qa-banner-scope {
          --ink:#191410; --cream:#FFF4EA; --orange:#F2610C; --amber:#FFB238; --rust:#8A3A0F;
          font-family:'Sora', sans-serif;
        }
        .qa-banner {
          position:relative; width:100%; height:56px;
          background:linear-gradient(100deg, var(--ink) 0%, #241a12 55%, var(--ink) 100%);
          border-radius:10px; overflow:hidden; display:flex; align-items:center; gap:14px;
          padding:0 16px;
          box-shadow:0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 20px rgba(0,0,0,0.25);
        }
        .qa-banner::before {
          content:""; position:absolute; top:0; left:-30%; width:30%; height:100%;
          background:linear-gradient(100deg, transparent, rgba(242,97,12,0.10), transparent);
          animation:qa-sweep 7s ease-in-out infinite;
        }
        @keyframes qa-sweep { 0%{left:-30%;} 45%{left:120%;} 100%{left:120%;} }

        .qa-box-scene { width:30px; height:30px; perspective:220px; flex:none; }
        .qa-box { position:relative; width:100%; height:100%; transform-style:preserve-3d; animation:qa-tumble 6s linear infinite; }
        .qa-face { position:absolute; width:21px; height:21px; left:4.5px; top:4.5px; border:1.5px solid var(--amber); background:rgba(242,97,12,0.18); border-radius:2px; }
        .qa-face.top { transform:translateZ(10.5px); background:rgba(255,178,56,0.28); }
        .qa-face.bottom { transform:rotateX(180deg) translateZ(10.5px); }
        .qa-face.front { transform:rotateX(-90deg) translateZ(10.5px); transform-origin:bottom; }
        .qa-face.back { transform:rotateX(90deg) translateZ(10.5px); transform-origin:top; }
        .qa-face.left { transform:rotateY(-90deg) translateZ(10.5px); }
        .qa-face.right { transform:rotateY(90deg) translateZ(10.5px); }
        @keyframes qa-tumble { 0%{transform:rotateX(0) rotateY(0);} 100%{transform:rotateX(360deg) rotateY(360deg);} }

        @media (prefers-reduced-motion: reduce) {
          .qa-box { animation:none; }
          .qa-banner::before { animation:none; }
        }

        .qa-message-track { position:relative; flex:1; height:100%; overflow:hidden; min-width:0; }
        .qa-msg {
          position:absolute; inset:0; display:flex; align-items:center;
          color:var(--cream); font-size:13px; font-weight:500; letter-spacing:0.1px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          opacity:0; transform:translateY(14px);
        }
        .qa-msg strong { color:var(--amber); font-weight:700; margin-right:6px; }
        .qa-msg.show { animation:qa-cycle 12s infinite; }
        .qa-msg:nth-child(1).show { animation-delay:0s; }
        .qa-msg:nth-child(2).show { animation-delay:4s; }
        .qa-msg:nth-child(3).show { animation-delay:8s; }
        @keyframes qa-cycle {
          0%{opacity:0;transform:translateY(14px);}
          4%{opacity:1;transform:translateY(0);}
          30%{opacity:1;transform:translateY(0);}
          34%{opacity:0;transform:translateY(-14px);}
          100%{opacity:0;transform:translateY(-14px);}
        }
        @media (prefers-reduced-motion: reduce) {
          .qa-msg.show { animation:none; opacity:0; }
          .qa-msg.show:nth-child(1) { opacity:1; }
        }

        .qa-trust {
          flex:none; color:rgba(255,244,234,0.55); font-size:12px; font-weight:400;
          padding-left:14px; border-left:1px solid rgba(255,244,234,0.14); white-space:nowrap;
        }
        @media (max-width:720px) { .qa-trust { display:none; } }
      `}</style>

      <div className="qa-banner-scope mb-3">
        <div className="qa-banner" role="region" aria-label="QAFRICA announcements">
          <div className="qa-box-scene" aria-hidden="true">
            <div className="qa-box">
              <div className="qa-face top" />
              <div className="qa-face bottom" />
              <div className="qa-face front" />
              <div className="qa-face back" />
              <div className="qa-face left" />
              <div className="qa-face right" />
            </div>
          </div>

          <div className="qa-message-track">
            <p className="qa-msg show"><strong>QAFRICA</strong> Nigeria's fastest growing import marketplace</p>
            <p className="qa-msg show">Pre-order now — split shipping fees across hundreds of orders</p>
            <p className="qa-msg show">Shipping fees from as low as <strong>₦800</strong></p>
          </div>

          <div className="qa-trust">Built for Nigeria</div>
        </div>
      </div>
    </>
  );
}
