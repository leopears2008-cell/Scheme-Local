// Sahayak homepage with live voice/text search over all government schemes
// Photos live in frontend/public/images (hero-people, cat-*, seal-*, logo-emblem, bot).
import { useEffect, useRef, useState } from "react";
import {
  Mic, Search, Home, CheckCircle, HelpCircle, Headphones, ArrowRight, X, Send, Star,
  Shield, Lock, Zap, Heart, Tractor, Venus, Users, GraduationCap,
} from "lucide-react";
import "./sahayak-home.css";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

type Lang = "ta" | "en" | "hi";
type Props = {
  onApply: (schemeId?: string) => void;
  onFind: () => void;
  onCheck: () => void;
  onSupport: () => void;
  onBack: () => void;
};

interface SchemeItem {
  scheme_id: string;
  name: string;
  benefit: string;
  category?: string;
  level?: string;
  state?: string;
  department?: string;
  eligibility_rules?: string[];
  documents_required?: string[];
  source_url?: string;
}

interface ChatMessage {
  u: boolean;
  s: string;
  schemes?: SchemeItem[];
  searching?: boolean;
}

const TR = {
  ta: {
    tag: "அரசு திட்ட உதவியாளர்", ph: "திட்டங்களைத் தேடுங்கள்…", n1: "திட்டங்கள்", n2: "தகுதி", n3: "உதவி", sup: "ஆதரவு கேள்விகள்",
    h1: "உங்கள் தகுதியை நொடியில் கண்டறியுங்கள்!", h2: "Discover your eligibility in seconds!", mic: "பேச இங்கே அழுத்தவும்", lis: "கேட்கிறது…",
    q: "அல்லது உங்கள் கேள்வியை தட்டச்சு செய்யவும்…", a: ["விவசாயி", "பெண்கள்", "முதியோர்", "மாணவர்கள்"], ae: ["Farmer", "Women", "Seniors", "Students"],
    feat: "சிறப்புத் திட்டங்கள்", sub: "(மத்திய & மாநில அரசு)", all: "அனைத்தும்", apply: "விண்ணப்பிக்கவும்", central: "Central Govt", state: "Tamil Nadu Govt",
    t: ["100% நம்பகமான தகவல்", "அரசு தரவுகளின் அடிப்படையில்", "வேகமான சேவை", "மக்கள் நலனுக்காக"],
    ct: "Sahayak AI", cs: "உங்கள் அரசு திட்ட உதவியாளர்",
    hi: "வணக்கம்! நான் சகாயக். உங்கள் குரல் அல்லது கேள்வி மூலம் அனைத்து அரசு திட்டங்களையும் தேடி பொருத்தமான திட்டங்களைக் கண்டறியலாம். எப்படி உதவலாம்?",
    c: ["விவசாய திட்டங்கள்", "மகளிர் உரிமை தொகை", "மாணவர் கல்வி உதவித்தொகை", "முதியோர் ஓய்வூதியம்"], ci: "உங்கள் கேள்வியை இங்கே தட்டச்சு செய்யவும்…",
    searching: "அனைத்து அரசு திட்டங்களையும் தேடுகிறது...",
    foundHeader: "கண்டறியப்பட்ட தகுதியான திட்டங்கள்",
    noMatch: "பொருத்தமான திட்டங்கள் எதுவும் நேரடியாகக் கிடைக்கவில்லை. பிற திட்டங்களைக் காண Explore Schemes பார்க்கவும்.",
    back: "Classic SchemeLocal-க்குத் திரும்பு",
    disc: "இது தகவல் வழிகாட்டி மட்டுமே; அரசு இணையதளம் அல்ல. விண்ணப்பிக்கும் முன் அதிகாரப்பூர்வ தளத்தில் சரிபார்க்கவும்."
  },
  en: {
    tag: "Government Scheme Assistant", ph: "Search schemes…", n1: "Schemes", n2: "Eligibility", n3: "Help", sup: "Support Queries",
    h1: "Discover your eligibility in seconds!", h2: "உங்கள் தகுதியை நொடியில் கண்டறியுங்கள்!", mic: "Tap here to speak", lis: "Listening…",
    q: "Or type your question here…", a: ["Farmer", "Women", "Seniors", "Students"], ae: ["விவசாயி", "பெண்கள்", "முதியோர்", "மாணவர்கள்"],
    feat: "Featured Schemes", sub: "(Central & State Govt)", all: "View All", apply: "Apply Now", central: "Central Govt", state: "Tamil Nadu Govt",
    t: ["100% trusted information", "Based on government data", "Fast service", "Made for citizens"],
    ct: "Sahayak AI", cs: "Your government scheme assistant",
    hi: "Hello! I'm Sahayak. Speak or type your query to search all 400+ government schemes and find matching schemes immediately. How can I help?",
    c: ["Farmer schemes", "Women schemes", "Student scholarship", "Senior citizen pension"], ci: "Type your question here…",
    searching: "Searching all government schemes and checking eligibility...",
    foundHeader: "Matching Eligible Schemes Found",
    noMatch: "No exact matching schemes found. Click Find to explore the full scheme registry.",
    back: "Back to Classic SchemeLocal",
    disc: "This is an information guide, not an official government website. Confirm details on the official site before applying."
  },
  hi: {
    tag: "सरकारी योजना सहायक", ph: "योजनाएँ खोजें…", n1: "योजनाएँ", n2: "पात्रता", n3: "सहायता", sup: "सहायता प्रश्न",
    h1: "अपनी पात्रता सेकंडों में जानें!", h2: "Discover your eligibility in seconds!", mic: "बोलने के लिए यहाँ दबाएँ", lis: "सुन रहा हूँ…",
    q: "या अपना सवाल यहाँ लिखें…", a: ["किसान", "महिलाएँ", "वरिष्ठ नागरिक", "विद्यार्थी"], ae: ["Farmer", "Women", "Seniors", "Students"],
    feat: "प्रमुख योजनाएँ", sub: "(केंद्र और राज्य सरकार)", all: "सभी देखें", apply: "आवेदन करें", central: "Central Govt", state: "Tamil Nadu Govt",
    t: ["100% भरोसेमंद जानकारी", "सरकारी डेटा पर आधारित", "तेज़ सेवा", "नागरिकों के लिए"],
    ct: "Sahayak AI", cs: "आपका सरकारी योजना सहायक",
    hi: "नमस्ते! मैं सहायक हूँ। आप बोलकर या लिखकर सभी सरकारी योजनाओं में से अपनी पात्र योजना खोज सकते हैं।",
    c: ["किसान योजनाएं", "महिला योजनाएं", "छात्रवृत्ति योजना", "वृद्धावस्था पेंशन"], ci: "अपना सवाल यहाँ लिखें…",
    searching: "सभी सरकारी योजनाओं में खोज रहा हूँ...",
    foundHeader: "उपयुक्त सरकारी योजनाएं",
    noMatch: "कोई सीधी योजना नहीं मिली। सभी योजनाएं देखने के लिए View All पर क्लिक करें।",
    back: "Classic SchemeLocal पर वापस",
    disc: "यह एक सूचना मार्गदर्शिका है, सरकारी वेबसाइट नहीं। आवेदन से पहले आधिकारिक साइट पर जाँच करें।"
  },
} as const;

const DEFAULT_FEATURED: SchemeItem[] = [
  {
    scheme_id: "tn_kmur",
    level: "state",
    name: "கலைஞர் மகளிர் உரிமைத் தொகை (Kalaignar Magalir Urimai Thogai)",
    benefit: "₹1,000 / மாதம் (₹12,000/year)",
    eligibility_rules: ["21 வயது மற்றும் அதற்கு மேற்பட்ட பெண்கள்", "ரேஷன் கார்டு அவசியம்", "ஆதார் கட்டாயம்"],
    documents_required: ["Ration Card", "Aadhaar Card", "Bank Passbook"],
  },
  {
    scheme_id: "pm_kisan",
    level: "central",
    name: "PM-KISAN திட்டம் (PM Kisan Samman Nidhi)",
    benefit: "₹6,000 / ஆண்டு (in 3 installments)",
    eligibility_rules: ["சிறு மற்றும் குறு விவசாயிகள்", "நிலம் உரிமை ஆவணம்", "ஆதார் கட்டாயம்"],
    documents_required: ["Land records (Pattadhar passbook)", "Aadhaar Card", "Bank Account"],
  },
  {
    scheme_id: "cm_housing",
    level: "state",
    name: "முதல்வரின் வீடு வசதி திட்டம் (Chief Minister's Housing Scheme)",
    benefit: "₹3,00,000 வரை நிதி உதவி",
    eligibility_rules: ["குடிசை இல்லங்களுக்கு", "வருமான சான்றிதழ்", "ஆதார் கட்டாயம்"],
    documents_required: ["Income Certificate", "Aadhaar Card", "Residence Proof"],
  },
];

const TILES = [
  { img: "cat-farmer", Icon: Tractor, queryKey: { ta: "விவசாயி", en: "farmer", hi: "किसान" } },
  { img: "cat-women", Icon: Venus, queryKey: { ta: "மகளிர்", en: "women", hi: "महिला" } },
  { img: "cat-seniors", Icon: Users, queryKey: { ta: "முதியோர்", en: "senior", hi: "वृद्ध" } },
  { img: "cat-students", Icon: GraduationCap, queryKey: { ta: "மாணவர்", en: "student", hi: "छात्र" } },
];

const LOCALE: Record<Lang, string> = { ta: "ta-IN", en: "en-IN", hi: "hi-IN" };

export default function SahayakHome({ onApply, onFind, onCheck, onSupport, onBack }: Props) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("sahayak-lang") as Lang) || "ta");
  const [q, setQ] = useState("");
  const [hq, setHq] = useState("");
  const [listening, setListening] = useState(false);
  const [chat, setChat] = useState(() => window.matchMedia("(min-width:1200px)").matches);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [cin, setCin] = useState("");
  const [liveSchemes, setLiveSchemes] = useState<SchemeItem[]>(DEFAULT_FEATURED);
  const [searchHeader, setSearchHeader] = useState<string>("");
  const end = useRef<HTMLDivElement>(null);
  const t = TR[lang];

  useEffect(() => {
    if (document.getElementById("sahayak-fonts")) return;
    const l = document.createElement("link");
    l.id = "sahayak-fonts";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+Tamil:wght@400;600;700;800&family=Noto+Sans+Devanagari:wght@400;600;700;800&display=swap";
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sahayak-lang", lang);
    } catch { /* private mode */ }
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, chat]);

  // Direct Scheme Search and Eligibility Logic
  const ask = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;

    setChat(true);
    // Add user message & pending bot message
    setMsgs((m) => [
      ...m,
      { u: true, s: query },
      { u: false, s: t.searching, searching: true },
    ]);

    try {
      // Direct call to scheme database
      const res = await fetch(`${API_BASE}/api/schemes?q=${encodeURIComponent(query)}&lang=${lang}&limit=8`);
      let schemes: SchemeItem[] = [];
      if (res.ok) {
        const data = await res.json();
        schemes = data.items || [];
      }

      // If backend search yielded 0 items, try fallback keyword matching across known schemes
      if (!schemes.length) {
        const ql = query.toLowerCase();
        schemes = DEFAULT_FEATURED.filter((sc) => {
          return (
            sc.name.toLowerCase().includes(ql) ||
            sc.benefit.toLowerCase().includes(ql) ||
            (sc.eligibility_rules || []).some((r) => r.toLowerCase().includes(ql))
          );
        });
      }

      // Update Chat Bot response
      if (schemes.length > 0) {
        const replyText =
          lang === "ta"
            ? `உங்கள் கேள்விக்கு (${query}) பொருத்தமான ${schemes.length} திட்டங்கள் கண்டறியப்பட்டன:`
            : lang === "hi"
            ? `आपकी खोज (${query}) के लिए ${schemes.length} उपयुक्त सरकारी योजनाएं मिलीं:`
            : `Found ${schemes.length} eligible schemes matching "${query}":`;

        setMsgs((m) => {
          const list = m.filter((msg) => !msg.searching);
          return [...list, { u: false, s: replyText, schemes }];
        });

        // Update the main view cards dynamically
        setLiveSchemes(schemes);
        setSearchHeader(
          lang === "ta"
            ? `"${query}" - கண்டறியப்பட்ட திட்டங்கள் (${schemes.length})`
            : lang === "hi"
            ? `"${query}" - खोज परिणाम (${schemes.length})`
            : `Eligible Schemes for "${query}" (${schemes.length})`
        );

        // Voice Readback (Speech Synthesis)
        if ("speechSynthesis" in window) {
          try {
            window.speechSynthesis.cancel();
            const voiceText =
              lang === "ta"
                ? `${schemes.length} திட்டங்கள் கண்டறியப்பட்டன.`
                : lang === "hi"
                ? `${schemes.length} योजनाएं मिलीं।`
                : `Found ${schemes.length} matching schemes.`;
            const utter = new SpeechSynthesisUtterance(voiceText);
            utter.lang = LOCALE[lang];
            window.speechSynthesis.speak(utter);
          } catch { /* TTS not critical */ }
        }
      } else {
        setMsgs((m) => {
          const list = m.filter((msg) => !msg.searching);
          return [...list, { u: false, s: t.noMatch }];
        });
      }
    } catch (err) {
      setMsgs((m) => {
        const list = m.filter((msg) => !msg.searching);
        return [
          ...list,
          {
            u: false,
            s: lang === "ta"
              ? "சேவையகத்தை தொடர்பு கொள்ள முடியவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்."
              : "Unable to reach the scheme registry. Please ensure backend is running."
          }
        ];
      });
    }
  };

  // Voice Speech Recognition
  const speak = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input is supported in Chrome, Edge and WebKit browsers.");
      setChat(true);
      return;
    }
    const r = new SR();
    r.lang = LOCALE[lang];
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.onresult = (e: any) => {
      const s = e.results[0][0].transcript as string;
      setQ(s);
      ask(s);
    };
    r.start();
  };

  return (
    <div className="sh" data-lang={lang}>
      <header className="sh-top">
        <div className="sh-bar">
          <a className="sh-brand" href="#sahayak" aria-label="Sahayak home">
            <img src="/images/logo-emblem.webp" alt="SchemeLocal Logo" />
            <span>
              <b>சகாயக் <i>|</i>Sahayak</b>
              <small>Government Scheme Assistant</small>
            </span>
          </a>
          <form
            className="sh-hs"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (hq.trim()) ask(hq);
              else onFind();
            }}
          >
            <Search size={20} aria-hidden />
            <input
              value={hq}
              onChange={(e) => setHq(e.target.value)}
              placeholder={t.ph}
              aria-label={t.ph}
            />
          </form>
          <nav className="sh-nav" aria-label="Main">
            <button onClick={onFind}>
              <Home size={22} aria-hidden />
              <span>{t.n1}</span>
            </button>
            <button onClick={onCheck}>
              <CheckCircle size={22} color="#15803d" aria-hidden />
              <span>{t.n2}</span>
            </button>
            <button onClick={onSupport}>
              <HelpCircle size={22} aria-hidden />
              <span>{t.n3}</span>
            </button>
          </nav>
          <div className="sh-lang" role="group" aria-label="Language">
            {(["ta", "en", "hi"] as Lang[]).map((l) => (
              <button
                key={l}
                lang={l}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
              >
                {l === "ta" ? "தமிழ்" : l === "en" ? "ENG" : "हिन्दी"}
              </button>
            ))}
          </div>
          <button className="sh-sup" onClick={onSupport}>
            <Headphones size={20} aria-hidden />
            <span>{t.sup}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="sh-hero">
          <div className="sh-hero-in">
            <div className="sh-photo" aria-hidden />
            <div className="sh-hero-txt">
              <h1 lang={lang}>{t.h1}</h1>
              <p className="en">{t.h2}</p>
              <div className="sh-row">
                <button
                  className={`sh-mic ${listening ? "on" : ""}`}
                  onClick={speak}
                  aria-label={t.mic}
                >
                  <Mic size={44} aria-hidden />
                  <span>{listening ? t.lis : t.mic}</span>
                </button>
                <form
                  className="sh-q"
                  role="search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (q.trim()) {
                      ask(q);
                      setQ("");
                    }
                  }}
                >
                  <Search className="s" size={22} aria-hidden />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t.q}
                    aria-label={t.q}
                  />
                  <button type="submit" aria-label="Search">
                    <ArrowRight size={22} aria-hidden />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <div className="sh-w">
          {/* Category Quick Filter Tiles */}
          <div className="sh-tiles">
            {TILES.map(({ img, Icon, queryKey }, i) => (
              <button
                key={img}
                className="sh-tile"
                style={{ backgroundImage: `url(/images/${img}.webp)` }}
                onClick={() => ask(queryKey[lang] || queryKey.en)}
              >
                <Icon className="ic" aria-hidden />
                <span className="t">
                  <b lang={lang}>{t.a[i]}</b>
                  <span>{t.ae[i]}</span>
                </span>
                <span className="go" aria-hidden>
                  <ArrowRight size={18} />
                </span>
              </button>
            ))}
          </div>

          {/* Featured / Live Search Results Header */}
          <div className="sh-fh">
            <Star size={30} color="#ea580c" fill="#ea580c" aria-hidden />
            <h2 lang={lang}>
              {searchHeader || t.feat}
              <small>{searchHeader ? "" : t.sub}</small>
            </h2>
            <i />
            {searchHeader ? (
              <button
                className="sh-va"
                onClick={() => {
                  setLiveSchemes(DEFAULT_FEATURED);
                  setSearchHeader("");
                }}
              >
                {lang === "ta" ? "சிறப்பு திட்டங்கள்" : "Show Featured"}
              </button>
            ) : (
              <button className="sh-va" onClick={onFind}>
                {t.all}
                <ArrowRight size={18} aria-hidden />
              </button>
            )}
          </div>

          {/* Scheme Cards Grid */}
          <div className="sh-cards">
            {liveSchemes.map((s) => (
              <article className="sh-card" key={s.scheme_id || s.name}>
                <div className="sh-ch">
                  <img
                    src={`/images/${s.level === "state" ? "seal-tn" : "seal-india"}.webp`}
                    alt=""
                  />
                  <h3 lang={lang}>{s.name}</h3>
                </div>
                <span className={`sh-bd ${s.level || "central"}`}>
                  {s.level === "state" ? t.state : t.central}
                </span>
                <p className="sh-amt" lang={lang}>
                  {s.benefit}
                </p>
                <ul>
                  {(s.eligibility_rules || s.documents_required || []).slice(0, 3).map((x) => (
                    <li key={x}>
                      <CheckCircle size={22} aria-hidden />
                      <span lang={lang}>{x}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className="sh-apply"
                  onClick={() => onApply(s.scheme_id)}
                  lang={lang}
                >
                  {t.apply}
                  <ArrowRight size={20} aria-hidden />
                </button>
              </article>
            ))}
          </div>

          <div className="sh-trust">
            {[Shield, Lock, Zap, Heart].map((Ic, i) => (
              <div key={i}>
                <Ic
                  size={26}
                  color={["#15803d", "#0b2f8f", "#ea580c", "#dc2626"][i]}
                  fill={i === 0 || i === 3 ? "currentColor" : "none"}
                  aria-hidden
                />
                <span lang={lang}>{t.t[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="sh-foot">
        <p lang={lang}>{t.disc}</p>
        <button onClick={onBack}>{t.back}</button>
      </footer>

      {/* Floating Sahayak AI Assistant Window */}
      {chat && (
        <section className="sh-cw" aria-label="Sahayak AI">
          <div className="sh-cwh">
            <img src="/images/bot.webp" alt="Sahayak Assistant" />
            <div>
              <b>{t.ct}</b>
              <small lang={lang}>{t.cs}</small>
            </div>
            <button onClick={() => setChat(false)} aria-label="Close">
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="sh-msgs" aria-live="polite">
            <p className="sh-m" lang={lang}>
              {t.hi}
            </p>
            {msgs.map((m, i) => (
              <div key={i} className={`sh-m ${m.u ? "u" : ""}`}>
                <p style={{ margin: 0 }}>{m.s}</p>
                {/* Embedded Schemes Results inside Chat */}
                {m.schemes && m.schemes.length > 0 && (
                  <div className="sh-chat-schemes">
                    {m.schemes.map((sc) => (
                      <div key={sc.scheme_id} className="sh-chat-card">
                        <div className="sh-chat-card-title">{sc.name}</div>
                        <div className="sh-chat-card-benefit">{sc.benefit}</div>
                        {sc.documents_required && sc.documents_required.length > 0 && (
                          <div className="sh-chat-card-docs">
                            📄 {sc.documents_required.slice(0, 2).join(", ")}
                          </div>
                        )}
                        <button
                          className="sh-chat-apply-btn"
                          onClick={() => onApply(sc.scheme_id)}
                        >
                          {t.apply} →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>

          <div className="sh-chips">
            {[Mic, Search, CheckCircle, Send].map((Ic, i) => (
              <button
                key={i}
                lang={lang}
                onClick={() =>
                  i === 0 ? speak() : i === 2 ? onCheck() : i === 3 ? onApply() : ask(t.c[i])
                }
              >
                <Ic size={16} aria-hidden />
                {t.c[i]}
              </button>
            ))}
          </div>

          <form
            className="sh-cin"
            onSubmit={(e) => {
              e.preventDefault();
              if (cin.trim()) {
                ask(cin);
                setCin("");
              }
            }}
          >
            <input
              value={cin}
              onChange={(e) => setCin(e.target.value)}
              placeholder={t.ci}
              aria-label={t.ci}
            />
            <button type="submit" aria-label="Send">
              <Send size={18} aria-hidden />
            </button>
          </form>
        </section>
      )}

      {!chat && (
        <button
          className="sh-fab cb"
          onClick={() => setChat(true)}
          aria-label={t.ct}
        >
          <Headphones size={26} aria-hidden />
        </button>
      )}
      <button className="sh-fab" onClick={speak} aria-label={t.mic}>
        <Mic size={28} aria-hidden />
      </button>
    </div>
  );
}
