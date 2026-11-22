// Sahayak homepage, rebuilt to match the approved design mock-up.
// Photos live in frontend/public/images (hero-people, cat-*, seal-*, logo-emblem, bot).
import { useEffect, useRef, useState } from "react";
import {
  Mic, Search, Home, CheckCircle, HelpCircle, Headphones, ArrowRight, X, Send, Star,
  Shield, Lock, Zap, Heart, Tractor, Venus, Users, GraduationCap,
} from "lucide-react";
import "./sahayak-home.css";

type Lang = "ta" | "en" | "hi";
type Props = { onApply: () => void; onFind: () => void; onCheck: () => void; onSupport: () => void; onBack: () => void };

const TR = {
  ta: { tag: "அரசு திட்ட உதவியாளர்", ph: "திட்டங்களைத் தேடுங்கள்…", n1: "திட்டங்கள்", n2: "தகுதி", n3: "உதவி", sup: "ஆதரவு கேள்விகள்",
    h1: "உங்கள் தகுதியை நொடியில் கண்டறியுங்கள்!", h2: "Discover your eligibility in seconds!", mic: "பேச இங்கே அழுத்தவும்", lis: "கேட்கிறது…",
    q: "அல்லது உங்கள் கேள்வியை தட்டச்சு செய்யவும்…", a: ["விவசாயி", "பெண்கள்", "முதியோர்", "மாணவர்கள்"], ae: ["Farmer", "Women", "Seniors", "Students"],
    feat: "சிறப்புத் திட்டங்கள்", sub: "(மத்திய & மாநில அரசு)", all: "அனைத்தும்", apply: "விண்ணப்பிக்கவும்", central: "Central Govt", state: "Tamil Nadu Govt",
    t: ["100% நம்பகமான தகவல்", "அரசு தரவுகளின் அடிப்படையில்", "வேகமான சேவை", "மக்கள் நலனுக்காக"],
    ct: "Sahayak AI", cs: "உங்கள் அரசு திட்ட உதவியாளர்", hi: "வணக்கம்! உங்கள் தகுதியை கண்டறிய நான் உதவ தயாராக உள்ளேன். எப்படி உதவலாம்?",
    c: ["குரலில் கேளுங்கள்", "திட்டங்களை தேடுங்கள்", "தகுதி சரிபார்க்கவும்", "விண்ணப்பம் தயாரிக்கவும்"], ci: "உங்கள் கேள்வியை இங்கே தட்டச்சு செய்யவும்…",
    rep: "பதிவு செய்தேன். உங்கள் மாவட்டம் மற்றும் வயதைச் சொன்னால் பொருத்தமான திட்டங்களைக் காட்டுவேன்.", back: "Classic MySchemeGuide-க்குத் திரும்பு",
    disc: "இது தகவல் வழிகாட்டி மட்டுமே; அரசு இணையதளம் அல்ல. விண்ணப்பிக்கும் முன் அதிகாரப்பூர்வ தளத்தில் சரிபார்க்கவும்." },
  en: { tag: "Government Scheme Assistant", ph: "Search schemes…", n1: "Schemes", n2: "Eligibility", n3: "Help", sup: "Support Queries",
    h1: "Discover your eligibility in seconds!", h2: "உங்கள் தகுதியை நொடியில் கண்டறியுங்கள்!", mic: "Tap here to speak", lis: "Listening…",
    q: "Or type your question here…", a: ["Farmer", "Women", "Seniors", "Students"], ae: ["விவசாயி", "பெண்கள்", "முதியோர்", "மாணவர்கள்"],
    feat: "Featured Schemes", sub: "(Central & State Govt)", all: "View All", apply: "Apply Now", central: "Central Govt", state: "Tamil Nadu Govt",
    t: ["100% trusted information", "Based on government data", "Fast service", "Made for citizens"],
    ct: "Sahayak AI", cs: "Your government scheme assistant", hi: "Hello! I'm ready to help you find the schemes you qualify for. How can I help?",
    c: ["Ask by voice", "Search schemes", "Check eligibility", "Prepare application"], ci: "Type your question here…",
    rep: "Noted. Tell me your district and age and I will show the schemes that fit.", back: "Back to Classic MySchemeGuide",
    disc: "This is an information guide, not an official government website. Confirm details on the official site before applying." },
  hi: { tag: "सरकारी योजना सहायक", ph: "योजनाएँ खोजें…", n1: "योजनाएँ", n2: "पात्रता", n3: "सहायता", sup: "सहायता प्रश्न",
    h1: "अपनी पात्रता सेकंडों में जानें!", h2: "Discover your eligibility in seconds!", mic: "बोलने के लिए यहाँ दबाएँ", lis: "सुन रहा हूँ…",
    q: "या अपना सवाल यहाँ लिखें…", a: ["किसान", "महिलाएँ", "वरिष्ठ नागरिक", "विद्यार्थी"], ae: ["Farmer", "Women", "Seniors", "Students"],
    feat: "प्रमुख योजनाएँ", sub: "(केंद्र और राज्य सरकार)", all: "सभी देखें", apply: "आवेदन करें", central: "Central Govt", state: "Tamil Nadu Govt",
    t: ["100% भरोसेमंद जानकारी", "सरकारी डेटा पर आधारित", "तेज़ सेवा", "नागरिकों के लिए"],
    ct: "Sahayak AI", cs: "आपका सरकारी योजना सहायक", hi: "नमस्ते! मैं आपकी पात्रता खोजने में मदद के लिए तैयार हूँ। कैसे मदद करूँ?",
    c: ["आवाज़ से पूछें", "योजनाएँ खोजें", "पात्रता जाँचें", "आवेदन तैयार करें"], ci: "अपना सवाल यहाँ लिखें…",
    rep: "ठीक है। अपना ज़िला और उम्र बताइए, मैं सही योजनाएँ दिखाऊँगा।", back: "Classic MySchemeGuide पर वापस",
    disc: "यह एक सूचना मार्गदर्शिका है, सरकारी वेबसाइट नहीं। आवेदन से पहले आधिकारिक साइट पर जाँच करें।" },
} as const;

const SCHEMES = [
  { lv: "state", seal: "seal-tn", n: { ta: "கலைஞர் மகளிர் உரிமைத் தொகை", en: "Kalaignar Magalir Urimai Thogai", hi: "कलैग्नार महिला उरिमई थोगई" },
    a: { ta: ["₹1,000", " / மாதம்"], en: ["₹1,000", " / month"], hi: ["₹1,000", " / माह"] },
    e: { ta: ["21 வயது மற்றும் அதற்கு மேற்பட்ட பெண்கள்", "ரேஷன் கார்டு அவசியம்", "ஆதார் கட்டாயம்"], en: ["Women aged 21 and above", "Ration card required", "Aadhaar required"], hi: ["21 वर्ष या अधिक की महिलाएँ", "राशन कार्ड आवश्यक", "आधार अनिवार्य"] } },
  { lv: "central", seal: "seal-india", n: { ta: "PM-KISAN திட்டம்", en: "PM-KISAN Scheme", hi: "पीएम-किसान योजना" },
    a: { ta: ["₹6,000", " / ஆண்டு"], en: ["₹6,000", " / year"], hi: ["₹6,000", " / वर्ष"] },
    e: { ta: ["சிறு மற்றும் குறு விவசாயிகள்", "நிலம் உரிமை ஆவணம்", "ஆதார் கட்டாயம்"], en: ["Small and marginal farmers", "Land ownership record", "Aadhaar required"], hi: ["छोटे और सीमांत किसान", "भूमि स्वामित्व रिकॉर्ड", "आधार अनिवार्य"] } },
  { lv: "state", seal: "seal-tn", n: { ta: "முதல்வரின் வீடு வசதி திட்டம்", en: "Chief Minister's Housing Scheme", hi: "मुख्यमंत्री आवास योजना" },
    a: { ta: ["₹3,00,000", " வரை"], en: ["₹3,00,000", " limit"], hi: ["₹3,00,000", " तक"] },
    e: { ta: ["குடிசை இல்லங்களுக்கு", "வருமான சான்றிதழ்", "ஆதார் கட்டாயம்"], en: ["For hut dwellers", "Income certificate", "Aadhaar required"], hi: ["झोपड़ी में रहने वालों के लिए", "आय प्रमाण पत्र", "आधार अनिवार्य"] } },
] as const;

const TILES = [{ img: "cat-farmer", Icon: Tractor }, { img: "cat-women", Icon: Venus }, { img: "cat-seniors", Icon: Users }, { img: "cat-students", Icon: GraduationCap }];
const LOCALE: Record<Lang, string> = { ta: "ta-IN", en: "en-IN", hi: "hi-IN" };

export default function SahayakHome({ onApply, onFind, onCheck, onSupport, onBack }: Props) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("sahayak-lang") as Lang) || "ta");
  const [q, setQ] = useState(""); const [hq, setHq] = useState("");
  const [listening, setListening] = useState(false);
  const [chat, setChat] = useState(() => window.matchMedia("(min-width:1200px)").matches);
  const [msgs, setMsgs] = useState<{ u: boolean; s: string }[]>([]);
  const [cin, setCin] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const t = TR[lang];

  useEffect(() => {
    if (document.getElementById("sahayak-fonts")) return;
    const l = document.createElement("link"); l.id = "sahayak-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+Tamil:wght@400;600;700;800&family=Noto+Sans+Devanagari:wght@400;600;700;800&display=swap";
    document.head.appendChild(l);
  }, []);
  useEffect(() => { try { localStorage.setItem("sahayak-lang", lang); } catch { /* private mode */ } document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, chat]);

  const ask = (s: string) => { const v = s.trim(); if (!v) return; setChat(true); setMsgs((m) => [...m, { u: true, s: v }, { u: false, s: t.rep }]); };
  const speak = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setChat(true); return; }
    const r = new SR(); r.lang = LOCALE[lang]; r.interimResults = false;
    r.onstart = () => setListening(true); r.onend = () => setListening(false); r.onerror = () => setListening(false);
    r.onresult = (e: any) => { const s = e.results[0][0].transcript as string; setQ(s); ask(s); };
    r.start();
  };

  return (
    <div className="sh" data-lang={lang}>
      <header className="sh-top"><div className="sh-bar">
        <a className="sh-brand" href="#sahayak" aria-label="Sahayak home">
          <img src="/images/logo-emblem.webp" alt="" />
          <span><b>சகாயக் <i>|</i>Sahayak</b><small>Government Scheme Assistant</small></span>
        </a>
        <form className="sh-hs" role="search" onSubmit={(e) => { e.preventDefault(); onFind(); }}>
          <Search size={20} aria-hidden /><input value={hq} onChange={(e) => setHq(e.target.value)} placeholder={t.ph} aria-label={t.ph} />
        </form>
        <nav className="sh-nav" aria-label="Main">
          <button onClick={onFind}><Home size={22} aria-hidden /><span>{t.n1}</span></button>
          <button onClick={onCheck}><CheckCircle size={22} color="#15803d" aria-hidden /><span>{t.n2}</span></button>
          <button onClick={onSupport}><HelpCircle size={22} aria-hidden /><span>{t.n3}</span></button>
        </nav>
        <div className="sh-lang" role="group" aria-label="Language">
          {(["ta", "en", "hi"] as Lang[]).map((l) => (
            <button key={l} lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l === "ta" ? "தமிழ்" : l === "en" ? "ENG" : "हिन्दी"}</button>
          ))}
        </div>
        <button className="sh-sup" onClick={onSupport}><Headphones size={20} aria-hidden /><span>{t.sup}</span></button>
      </div></header>

      <main>
        <section className="sh-hero"><div className="sh-hero-in">
          <div className="sh-photo" aria-hidden />
          <div className="sh-hero-txt">
            <h1 lang={lang}>{t.h1}</h1><p className="en">{t.h2}</p>
            <div className="sh-row">
              <button className={`sh-mic ${listening ? "on" : ""}`} onClick={speak} aria-label={t.mic}>
                <Mic size={44} aria-hidden /><span>{listening ? t.lis : t.mic}</span>
              </button>
              <form className="sh-q" role="search" onSubmit={(e) => { e.preventDefault(); ask(q); setQ(""); }}>
                <Search className="s" size={22} aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.q} aria-label={t.q} />
                <button type="submit" aria-label="Search"><ArrowRight size={22} aria-hidden /></button>
              </form>
            </div>
          </div>
        </div></section>

        <div className="sh-w">
          <div className="sh-tiles">
            {TILES.map(({ img, Icon }, i) => (
              <button key={img} className="sh-tile" style={{ backgroundImage: `url(/images/${img}.webp)` }} onClick={onFind}>
                <Icon className="ic" aria-hidden /><span className="t"><b lang={lang}>{t.a[i]}</b><span>{t.ae[i]}</span></span>
                <span className="go" aria-hidden><ArrowRight size={18} /></span>
              </button>
            ))}
          </div>

          <div className="sh-fh">
            <Star size={30} color="#ea580c" fill="#ea580c" aria-hidden />
            <h2 lang={lang}>{t.feat}<small>{t.sub}</small></h2><i />
            <button className="sh-va" onClick={onFind}>{t.all}<ArrowRight size={18} aria-hidden /></button>
          </div>
          <div className="sh-cards">
            {SCHEMES.map((s) => (
              <article className="sh-card" key={s.n.en}>
                <div className="sh-ch"><img src={`/images/${s.seal}.webp`} alt="" /><h3 lang={lang}>{s.n[lang]}</h3></div>
                <span className={`sh-bd ${s.lv}`}>{t[s.lv as "state" | "central"]}</span>
                <p className="sh-amt" lang={lang}>{s.a[lang][0]}<span>{s.a[lang][1]}</span></p>
                <ul>{s.e[lang].map((x) => <li key={x}><CheckCircle size={22} aria-hidden /><span lang={lang}>{x}</span></li>)}</ul>
                <button className="sh-apply" onClick={onApply} lang={lang}>{t.apply}<ArrowRight size={20} aria-hidden /></button>
              </article>
            ))}
          </div>

          <div className="sh-trust">
            {[Shield, Lock, Zap, Heart].map((Ic, i) => (
              <div key={i}><Ic size={26} color={["#15803d", "#0b2f8f", "#ea580c", "#dc2626"][i]} fill={i === 0 || i === 3 ? "currentColor" : "none"} aria-hidden /><span lang={lang}>{t.t[i]}</span></div>
            ))}
          </div>
        </div>
      </main>

      <footer className="sh-foot"><p lang={lang}>{t.disc}</p><button onClick={onBack}>{t.back}</button></footer>

      {chat && (
        <section className="sh-cw" aria-label="Sahayak AI">
          <div className="sh-cwh"><img src="/images/bot.webp" alt="" /><div><b>{t.ct}</b><small lang={lang}>{t.cs}</small></div>
            <button onClick={() => setChat(false)} aria-label="Close"><X size={22} aria-hidden /></button></div>
          <div className="sh-msgs" aria-live="polite">
            <p className="sh-m" lang={lang}>{t.hi}</p>
            {msgs.map((m, i) => <p key={i} className={`sh-m ${m.u ? "u" : ""}`}>{m.s}</p>)}<div ref={end} />
          </div>
          <div className="sh-chips">
            {[Mic, Search, CheckCircle, Send].map((Ic, i) => (
              <button key={i} lang={lang} onClick={() => (i === 0 ? speak() : i === 2 ? onCheck() : i === 3 ? onApply() : ask(t.c[i]))}><Ic size={16} aria-hidden />{t.c[i]}</button>
            ))}
          </div>
          <form className="sh-cin" onSubmit={(e) => { e.preventDefault(); ask(cin); setCin(""); }}>
            <input value={cin} onChange={(e) => setCin(e.target.value)} placeholder={t.ci} aria-label={t.ci} />
            <button type="submit" aria-label="Send"><Send size={18} aria-hidden /></button>
          </form>
        </section>
      )}
      {!chat && <button className="sh-fab cb" onClick={() => setChat(true)} aria-label={t.ct}><Headphones size={26} aria-hidden /></button>}
      <button className="sh-fab" onClick={speak} aria-label={t.mic}><Mic size={28} aria-hidden /></button>
    </div>
  );
}
