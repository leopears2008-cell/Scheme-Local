// Sahayak – Government Scheme Assistant
// Pixel-match recreation of the reference design.
// Colors: Navy #102F8C | Deep Navy #071D67 | Orange #F46B0B | Green #138A28 | BG #F8F9FC | Border #E6EAF2 | Text #202437
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Search, Home, CheckCircle, HelpCircle, Bell, ChevronRight, Star,
  MessageSquare, Send, X, Eye, EyeOff, Smartphone, Mail, Phone,
  Shield, Lock, Zap, Heart, ArrowRight, User, LogIn, ChevronDown, Volume2,
} from "lucide-react";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

const C = {
  navy: "#102F8C",
  deepNavy: "#071D67",
  orange: "#F46B0B",
  green: "#138A28",
  bg: "#F8F9FC",
  white: "#FFFFFF",
  border: "#E6EAF2",
  text: "#202437",
};

// ─── Translation map ───────────────────────────────────────────────────────────
type Lang = "ta" | "en" | "hi";
const TR: Record<string, Record<Lang, string>> = {
  headline1: { ta: "உங்கள் தகுதியை", en: "Discover Your", hi: "अपनी पात्रता" },
  headline2: { ta: "நொடியில் கண்டறியுங்கள்!", en: "Eligibility in Seconds!", hi: "पलभर में जानें!" },
  heroSub: {
    ta: "AI-இயக்கப்படும் குரல் உதவியாளர் மூலம் அரசு திட்டங்களை கண்டறியுங்கள்",
    en: "Discover government schemes through our AI-powered voice assistant",
    hi: "AI-संचालित आवाज़ सहायक से सरकारी योजनाएं खोजें",
  },
  tapToSpeak: { ta: "பேச இங்கே அழுத்தவும்", en: "Tap to Speak", hi: "बोलने के लिए दबाएं" },
  listening: { ta: "கேட்கிறது...", en: "Listening...", hi: "सुन रहा हूँ..." },
  searchPlaceholder: {
    ta: "அல்லது உங்கள் கேள்வியை திட்டச்செய்யவும்...",
    en: "Or type your question here...",
    hi: "या यहाँ अपना सवाल लिखें...",
  },
  categories: { ta: "திட்ட வகைகள்", en: "Scheme Categories", hi: "योजना श्रेणियाँ" },
  featuredSchemes: { ta: "சிறப்பு திட்டங்கள்", en: "Featured Schemes", hi: "विशेष योजनाएं" },
  applyNow: { ta: "விண்ணப்பிக்கவும்", en: "Apply Now", hi: "अभी आवेदन करें" },
  checkEligibility: { ta: "தகுதி சரிபார்க்கவும்", en: "Check Eligibility", hi: "पात्रता जांचें" },
  loginBtn: { ta: "உள்நுழைக", en: "Login", hi: "लॉगिन" },
  supportQueries: { ta: "ஆதரவு கேள்விகள்", en: "Support Queries", hi: "सहायता प्रश्न" },
  schemes: { ta: "திட்டங்கள்", en: "Schemes", hi: "योजनाएं" },
  eligibility: { ta: "தகுதி", en: "Eligibility", hi: "पात्रता" },
  help: { ta: "உதவி", en: "Help", hi: "सहायता" },
  farmer: { ta: "விவசாயி", en: "Farmers", hi: "किसान" },
  women: { ta: "பெண்கள்", en: "Women", hi: "महिलाएं" },
  seniors: { ta: "முதியோர்", en: "Seniors", hi: "वरिष्ठ नागरिक" },
  students: { ta: "மாணவர்கள்", en: "Students", hi: "छात्र" },
  trusted: { ta: "நம்பகமான", en: "Trusted", hi: "भरोसेमंद" },
  govtData: { ta: "அரசு தரவு", en: "Govt. Data", hi: "सरकारी डेटा" },
  fast: { ta: "வேகமான", en: "Lightning Fast", hi: "तेज़" },
  welfare: { ta: "மக்கள் நலன்", en: "People First", hi: "जन कल्याण" },
  chatTitle: { ta: "சகாயக் AI", en: "Sahayak AI", hi: "सहायक AI" },
  chatWelcome: {
    ta: "வணக்கம்! நான் சகாயக், உங்கள் அரசு திட்ட உதவியாளர். எப்படி உதவலாம்?",
    en: "Hello! I'm Sahayak, your government scheme assistant. How can I help you today?",
    hi: "नमस्ते! मैं सहायक हूँ, आपका सरकारी योजना सहायक।",
  },
  typeMessage: { ta: "ஒரு செய்தியை தட்டச்சு செய்யவும்...", en: "Type a message...", hi: "संदेश लिखें..." },
  subtitle: { ta: "அரசு திட்ட உதவியாளர்", en: "Government Scheme Assistant", hi: "सरकारी योजना सहायक" },
};

function t(key: string, lang: Lang): string {
  return TR[key]?.[lang] ?? TR[key]?.["en"] ?? key;
}

// ─── Scheme data ───────────────────────────────────────────────────────────────
const SCHEMES = [
  {
    id: 1,
    name: { ta: "கலைஞர் மகளிர் உரிமைத் திட்டம்", en: "Kalaignar Magalir Urimai Thittam", hi: "कलैंजर महिला योजना" },
    govt: "TN Govt",
    category: "women",
    benefit: { ta: "₹1,000/மாதம்", en: "₹1,000/month", hi: "₹1,000/माह" },
    color: "#FF6B6B",
    icon: "👩",
    checks: { ta: ["18 வயதுக்கு மேல்", "தமிழ்நாடு குடியிருப்பாளர்", "BPL குடும்பம்"], en: ["Above 18 years", "TN Resident", "BPL Family"], hi: ["18 वर्ष से अधिक", "तमिलनाडु निवासी", "BPL परिवार"] },
  },
  {
    id: 2,
    name: { ta: "PM-KISAN திட்டம்", en: "PM-KISAN Scheme", hi: "PM-KISAN योजना" },
    govt: "Central Govt",
    category: "farmer",
    benefit: { ta: "₹6,000/ஆண்டு", en: "₹6,000/year", hi: "₹6,000/वर्ष" },
    color: "#4CAF50",
    icon: "🌾",
    checks: { ta: ["விவசாயக் குடும்பம்", "ஆதார் இணைப்பு", "வங்கி கணக்கு"], en: ["Farmer Family", "Aadhaar Linked", "Bank Account"], hi: ["किसान परिवार", "आधार लिंक", "बैंक खाता"] },
  },
  {
    id: 3,
    name: { ta: "முதல்வரின் வீடு திட்டம்", en: "Chief Minister's Housing Scheme", hi: "मुख्यमंत्री आवास योजना" },
    govt: "TN Govt",
    category: "seniors",
    benefit: { ta: "₹3,00,000 வரை", en: "Up to ₹3,00,000", hi: "₹3,00,000 तक" },
    color: "#2196F3",
    icon: "🏠",
    checks: { ta: ["BPL குடும்பம்", "சொந்த வீடு இல்லை", "தமிழ்நாட்டில் 5 ஆண்டு வசிப்பு"], en: ["BPL Family", "No Own House", "5 Yrs TN Residency"], hi: ["BPL परिवार", "अपना घर नहीं", "5 साल TN निवास"] },
  },
  {
    id: 4,
    name: { ta: "மாணவர் உதவித்தொகை", en: "Student Scholarship", hi: "छात्रवृत्ति योजना" },
    govt: "Central Govt",
    category: "students",
    benefit: { ta: "₹12,000/ஆண்டு", en: "₹12,000/year", hi: "₹12,000/वर्ष" },
    color: "#9C27B0",
    icon: "🎓",
    checks: { ta: ["SC/ST மாணவர்", "75% மேல் மதிப்பெண்", "வருமான வரம்பு"], en: ["SC/ST Students", "75%+ Marks", "Income Limit"], hi: ["SC/ST छात्र", "75%+ अंक", "आय सीमा"] },
  },
  {
    id: 5,
    name: { ta: "அன்னதான திட்டம்", en: "Free Ration Scheme", hi: "मुफ्त राशन योजना" },
    govt: "TN Govt",
    category: "seniors",
    benefit: { ta: "5 கிலோ அரிசி/மாதம்", en: "5 Kg Rice/month", hi: "5 किलो चावल/माह" },
    color: "#FF9800",
    icon: "🍚",
    checks: { ta: ["ரேஷன் அட்டை உள்ளவர்", "BPL தகுதி", "தமிழ்நாடு குடியிருப்பு"], en: ["Ration Card Holder", "BPL Eligible", "TN Resident"], hi: ["राशन कार्ड", "BPL पात्र", "TN निवासी"] },
  },
  {
    id: 6,
    name: { ta: "விவசாய கடன் மாஃபி", en: "Farm Loan Waiver", hi: "कृषि ऋण माफी" },
    govt: "TN Govt",
    category: "farmer",
    benefit: { ta: "₹1,00,000 வரை", en: "Up to ₹1,00,000", hi: "₹1,00,000 तक" },
    color: "#00BCD4",
    icon: "💰",
    checks: { ta: ["விவசாயி", "வங்கி கடன்", "தமிழ்நாட்டில் நிலம்"], en: ["Farmer", "Bank Loan", "Land in TN"], hi: ["किसान", "बैंक ऋण", "TN में भूमि"] },
  },
];

const CATEGORIES = [
  { key: "farmer", emoji: "🌾", img: "/images/cat-farmer.webp" },
  { key: "women",  emoji: "👩", img: "/images/cat-women.webp" },
  { key: "seniors",emoji: "👴", img: "/images/cat-seniors.webp" },
  { key: "students",emoji:"🎓", img: "/images/cat-students.webp" },
];

const CHAT_SUGGESTIONS = [
  { ta: "விவசாய திட்டங்கள் என்ன?", en: "What are farming schemes?", hi: "कृषि योजनाएं क्या हैं?" },
  { ta: "மகளிர் திட்டங்கள்", en: "Women's schemes", hi: "महिला योजनाएं" },
  { ta: "தகுதி சரிபார்க்கவும்", en: "Check my eligibility", hi: "पात्रता जांचें" },
  { ta: "அடுத்த படிகள்", en: "Next steps to apply", hi: "आवेदन के अगले चरण" },
];

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar({ lang, setLang, onLogin }: { lang: Lang; setLang: (l: Lang) => void; onLogin: () => void }) {
  const [searchVal, setSearchVal] = useState("");
  return (
    <nav
      className="sticky top-0 z-40 w-full"
      style={{ background: C.white, borderBottom: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(16,47,140,0.07)" }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/images/sahayak-logo.webp"
            alt="Sahayak Logo"
            className="w-10 h-10 rounded-full object-cover shadow border border-white/20"
          />
          <div className="leading-tight">
            <div className="font-bold text-base" style={{ color: C.navy }}>
              சகாயக் <span className="text-sm font-medium">| Sahayak</span>
            </div>
            <div className="text-xs" style={{ color: "#6B7280" }}>{t("subtitle", lang)}</div>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xs relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
          <input
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search schemes..."
            className="w-full pl-9 pr-3 py-2 rounded-full text-sm outline-none"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
          />
        </div>

        {/* Nav links */}
        <div className="hidden lg:flex items-center gap-5">
          {[
            { label: t("schemes", lang), icon: <Home className="w-4 h-4" style={{ color: C.navy }} /> },
            { label: t("eligibility", lang), icon: <CheckCircle className="w-4 h-4" style={{ color: C.green }} /> },
            { label: t("help", lang), icon: <HelpCircle className="w-4 h-4" style={{ color: C.navy }} /> },
          ].map(({ label, icon }) => (
            <button key={label} className="flex items-center gap-1 text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: C.text }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Language toggle */}
          <div
            className="flex items-center rounded-full text-xs font-semibold overflow-hidden"
            style={{ border: `1px solid ${C.border}` }}
          >
            {(["ta", "en", "hi"] as Lang[]).map((l, i) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className="px-2 py-1 transition-colors"
                style={{
                  background: lang === l ? C.navy : C.white,
                  color: lang === l ? C.white : C.text,
                  borderRight: i < 2 ? `1px solid ${C.border}` : undefined,
                }}
              >
                {l === "ta" ? "தமிழ்" : l === "en" ? "ENG" : "हिन्दी"}
              </button>
            ))}
          </div>

          {/* Support button */}
          <button
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: C.navy }}
          >
            <Bell className="w-3.5 h-3.5" />
            {t("supportQueries", lang)}
          </button>

          {/* Login */}
          <button
            onClick={onLogin}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: `${C.orange}15`, color: C.orange, border: `1px solid ${C.orange}30` }}
          >
            <LogIn className="w-3.5 h-3.5" />
            {t("loginBtn", lang)}
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function Hero({ lang, onSearch }: { lang: Lang; onSearch: (q: string) => void }) {
  const [isListening, setIsListening] = useState(false);
  const [query, setQuery] = useState("");
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice recognition not supported in this browser. Please use Chrome.");
      return;
    }
    const r: any = new SR();
    r.lang = lang === "ta" ? "ta-IN" : lang === "hi" ? "hi-IN" : "en-IN";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQuery(transcript);
      onSearch(transcript);
      setIsListening(false);
    };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  }, [lang, onSearch]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return (
    <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.deepNavy} 0%, ${C.navy} 50%, #1a4fc4 100%)` }}>
      {/* Background hero image */}
      <div className="absolute inset-0 opacity-25">
        <img
          src="/images/sahayak-hero.webp"
          alt="Citizens and rural landscape"
          className="w-full h-full object-cover"
        />
      </div>
      {/* Soft gradient overlay */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${C.deepNavy}ee 0%, ${C.navy}cc 60%, transparent 100%)` }} />

      <div className="relative max-w-7xl mx-auto px-4 py-20 lg:py-28 flex flex-col lg:flex-row items-center gap-12">
        {/* Left text */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="flex-1 text-white"
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            AI-Powered • Voice-First • Government Verified
          </div>

          <h1 className="text-4xl lg:text-6xl font-extrabold leading-tight mb-4" style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}>
            {t("headline1", lang)}<br />
            <span style={{ color: "#FCD34D" }}>{t("headline2", lang)}</span>
          </h1>
          <p className="text-lg text-blue-100 mb-8 max-w-lg">{t("heroSub", lang)}</p>

          {/* Stats */}
          <div className="flex flex-wrap gap-6">
            {[["500+", "Schemes"], ["2.5Cr+", "Citizens Helped"], ["28", "States"]].map(([val, lbl]) => (
              <div key={lbl}>
                <div className="text-2xl font-bold text-yellow-300">{val}</div>
                <div className="text-xs text-blue-200">{lbl}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: Voice + Search */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="flex-1 flex flex-col items-center gap-6"
        >
          {/* Mic button */}
          <div className="relative flex items-center justify-center">
            {/* Pulsing rings */}
            {isListening && (
              <>
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 180, height: 180, border: `3px solid ${C.orange}`, opacity: 0.4 }}
                  animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 150, height: 150, border: `3px solid ${C.orange}`, opacity: 0.5 }}
                  animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                />
              </>
            )}
            {!isListening && (
              <>
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 160, height: 160, border: `2px solid rgba(244,107,11,0.3)` }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                />
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 130, height: 130, border: `2px solid rgba(244,107,11,0.5)` }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5, delay: 0.4 }}
                />
              </>
            )}

            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={isListening ? stopListening : startListening}
              aria-label={isListening ? "Stop listening" : "Tap to speak"}
              aria-pressed={isListening}
              className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center text-white font-bold shadow-2xl z-10 transition-all"
              style={{
                background: isListening
                  ? `linear-gradient(135deg, #DC2626, #B91C1C)`
                  : `linear-gradient(135deg, ${C.orange}, #d45700)`,
                boxShadow: `0 0 40px ${C.orange}60`,
              }}
            >
              <Mic className={`w-10 h-10 ${isListening ? "animate-pulse" : ""}`} />
            </motion.button>
          </div>

          <div className="text-center">
            <div className="text-white font-semibold text-sm" style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}>
              {isListening ? t("listening", lang) : t("tapToSpeak", lang)}
            </div>
            <div className="text-blue-200 text-xs mt-1">Web Speech API • Tamil / English / Hindi</div>
          </div>

          {/* Search bar */}
          <div
            className="w-full max-w-sm relative rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(12px)" }}
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white opacity-70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch(query)}
              placeholder={t("searchPlaceholder", lang)}
              aria-label="Scheme search query"
              className="w-full bg-transparent pl-11 pr-14 py-4 text-white placeholder-blue-200 text-sm outline-none"
              style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}
            />
            <button
              onClick={() => onSearch(query)}
              aria-label="Submit search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white"
              style={{ background: C.orange }}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-2 justify-center">
            {["விவசாயி திட்டங்கள்", "மகளிர் உரிமை", "மாணவர் உதவி"].map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); onSearch(s); }}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── TRUST BAR ────────────────────────────────────────────────────────────────
function TrustBar({ lang }: { lang: Lang }) {
  const items = [
    { icon: <Shield className="w-5 h-5" />, label: t("trusted", lang), color: C.green },
    { icon: <Lock className="w-5 h-5" />, label: t("govtData", lang), color: C.navy },
    { icon: <Zap className="w-5 h-5" />, label: t("fast", lang), color: C.orange },
    { icon: <Heart className="w-5 h-5" />, label: t("welfare", lang), color: "#DC2626" },
  ];
  return (
    <div className="w-full" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-center gap-8">
        {items.map(({ icon, label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span style={{ color }}>{icon}</span>
            <span className="text-sm font-semibold" style={{ color: C.text }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CATEGORY CARDS ───────────────────────────────────────────────────────────
function CategoryCards({ lang, activeCategory, setCategory }: { lang: Lang; activeCategory: string; setCategory: (c: string) => void }) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: C.text }}>{t("categories", lang)}</h2>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            {lang === "ta" ? "உங்கள் வகையை தேர்ந்தெடுக்கவும்" : "Select your category to find relevant schemes"}
          </p>
        </div>
        <button
          onClick={() => setCategory("")}
          className="text-sm font-medium flex items-center gap-1 hover:opacity-70"
          style={{ color: C.navy }}
        >
          {lang === "ta" ? "அனைத்தும்" : "View All"} <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {CATEGORIES.map(({ key, img }) => (
          <motion.button
            key={key}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCategory(activeCategory === key ? "" : key)}
            className="relative rounded-2xl overflow-hidden h-44 text-left focus:outline-none"
            style={{
              boxShadow: activeCategory === key
                ? `0 0 0 3px ${C.orange}, 0 8px 32px rgba(244,107,11,0.3)`
                : "0 4px 20px rgba(16,47,140,0.12)",
            }}
          >
            <img src={img} alt={key} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(7,29,103,0.85) 40%, transparent)" }} />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <div className="font-bold text-base" style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}>
                {t(key, lang)}
              </div>
              <div className="text-xs text-blue-200 mt-0.5">
                {SCHEMES.filter((s) => s.category === key).length} {lang === "ta" ? "திட்டங்கள்" : "Schemes"}
              </div>
            </div>
            <div
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: activeCategory === key ? C.orange : "rgba(255,255,255,0.2)" }}
            >
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

// ─── SCHEME CARD ──────────────────────────────────────────────────────────────
function SchemeCard({ scheme, lang, onApply }: { scheme: typeof SCHEMES[0]; lang: Lang; onApply: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: C.white, border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(16,47,140,0.08)" }}
    >
      {/* Header band */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-start justify-between gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: `${scheme.color}18` }}
          >
            {scheme.icon}
          </div>
          <span
            className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
            style={{
              background: scheme.govt === "Central Govt" ? `${C.navy}15` : `${C.orange}15`,
              color: scheme.govt === "Central Govt" ? C.navy : C.orange,
            }}
          >
            {scheme.govt}
          </span>
        </div>
        <h3 className="font-bold text-base mt-3 leading-snug" style={{ color: C.text, fontFamily: "'Noto Sans Tamil', sans-serif" }}>
          {scheme.name[lang]}
        </h3>
        {/* Benefit */}
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-xs font-medium" style={{ color: "#6B7280" }}>
            {lang === "ta" ? "நிதி உதவி:" : "Financial Benefit:"}
          </span>
          <span className="text-sm font-bold" style={{ color: C.green }}>{scheme.benefit[lang]}</span>
        </div>
      </div>

      {/* Checks */}
      <div className="px-5 py-4 flex-1">
        <ul className="space-y-1.5">
          {scheme.checks[lang].map((c) => (
            <li key={c} className="flex items-start gap-2 text-xs" style={{ color: C.text }}>
              <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: C.green }} />
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-2">
        <button
          onClick={onApply}
          className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1"
          style={{ background: C.orange }}
        >
          {t("applyNow", lang)} →
        </button>
        <button
          className="px-3 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: `${C.navy}10`, color: C.navy }}
        >
          <CheckCircle className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── FEATURED SCHEMES ─────────────────────────────────────────────────────────
function FeaturedSchemes({ lang, search, activeCategory, onApply }: { lang: Lang; search: string; activeCategory: string; onApply: () => void }) {
  const filtered = SCHEMES.filter((s) => {
    const name = s.name[lang].toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = !search || name.includes(q) || s.benefit[lang].toLowerCase().includes(q);
    const matchCat = !activeCategory || s.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <section className="py-12" style={{ background: `${C.navy}08` }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 fill-current" style={{ color: C.orange }} />
            <div>
              <h2 className="text-2xl font-bold" style={{ color: C.text }}>{t("featuredSchemes", lang)}</h2>
              <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
                {filtered.length} {lang === "ta" ? "திட்டங்கள் கிடைக்கின்றன" : "schemes available"}
              </p>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg font-semibold" style={{ color: C.text }}>
              {lang === "ta" ? "திட்டங்கள் கிடைக்கவில்லை" : "No schemes found"}
            </p>
            <p className="text-sm mt-2" style={{ color: "#6B7280" }}>
              {lang === "ta" ? "வேறு தேடல் வார்த்தை முயற்சிக்கவும்" : "Try a different search term"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((s) => (
              <SchemeCard key={s.id} scheme={s} lang={lang} onApply={onApply} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────
function HowItWorks({ lang }: { lang: Lang }) {
  const steps = [
    { n: "01", icon: "🎙️", title: lang === "ta" ? "குரல் / தேடல்" : "Speak / Search", desc: lang === "ta" ? "உங்கள் தேவையை குரல் மூலம் அல்லது தட்டச்சு மூலம் சொல்லுங்கள்" : "Tell us your need via voice or text" },
    { n: "02", icon: "🤖", title: lang === "ta" ? "AI பகுப்பாய்வு" : "AI Analysis", desc: lang === "ta" ? "AI உங்கள் தகுதியை ஆராய்கிறது" : "AI analyses your eligibility instantly" },
    { n: "03", icon: "📋", title: lang === "ta" ? "திட்டங்கள் பட்டியல்" : "Scheme List", desc: lang === "ta" ? "உங்களுக்கு பொருந்தும் திட்டங்கள் காண்பிக்கப்படுகின்றன" : "Matching schemes are shown to you" },
    { n: "04", icon: "✅", title: lang === "ta" ? "விண்ணப்பிக்கவும்" : "Apply", desc: lang === "ta" ? "ஒரே இடத்தில் விண்ணப்பிக்கவும்" : "Apply from one single place" },
  ];
  return (
    <section className="py-16" style={{ background: C.white }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold" style={{ color: C.text }}>
            {lang === "ta" ? "எவ்வாறு செயல்படுகிறது?" : "How Does It Work?"}
          </h2>
          <p className="text-sm mt-2" style={{ color: "#6B7280" }}>
            {lang === "ta" ? "நான்கு எளிய படிகளில் உங்கள் திட்டங்களை கண்டறியுங்கள்" : "Find your schemes in 4 simple steps"}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <motion.div
              key={s.n}
              whileHover={{ y: -4 }}
              className="text-center p-6 rounded-2xl"
              style={{ background: C.bg, border: `1px solid ${C.border}` }}
            >
              <div className="text-4xl mb-4">{s.icon}</div>
              <div className="text-xs font-bold mb-2" style={{ color: C.orange }}>{s.n}</div>
              <div className="font-bold text-sm mb-2" style={{ color: C.text, fontFamily: "'Noto Sans Tamil', sans-serif" }}>{s.title}</div>
              <div className="text-xs leading-relaxed" style={{ color: "#6B7280", fontFamily: "'Noto Sans Tamil', sans-serif" }}>{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── AI CHAT WIDGET ───────────────────────────────────────────────────────────
type ChatMsg = { role: "ai" | "user"; text: string };

function AIChatWidget({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: t("chatWelcome", lang) },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setInput("");
    // Simulated AI reply
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "ai", text: lang === "ta"
          ? `"${userMsg}" பற்றிய தகவல்களை தேடுகிறேன். உங்கள் மாவட்டம் மற்றும் வயதை பகிர்ந்தால் சிறந்த திட்டங்கள் காட்டலாம்.`
          : `Searching for information about "${userMsg}". Share your district and age for better scheme matches.` },
      ]);
    }, 1000);
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-2xl z-50"
        style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.deepNavy})` }}
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X className="w-6 h-6" /></motion.span>
            : <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><MessageSquare className="w-6 h-6" /></motion.span>
          }
        </AnimatePresence>
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold" style={{ background: C.orange }}>!</span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 right-6 w-80 rounded-2xl overflow-hidden shadow-2xl z-50 flex flex-col"
            style={{ maxHeight: 480, border: `1px solid ${C.border}` }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.deepNavy})` }}>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xl">🤖</div>
              <div className="flex-1">
                <div className="font-bold text-white text-sm">{t("chatTitle", lang)}</div>
                <div className="text-xs text-blue-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {lang === "ta" ? "இப்போது இயங்குகிறது" : "Online Now"}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ background: C.bg }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed"
                    style={{
                      background: m.role === "ai" ? C.white : C.navy,
                      color: m.role === "ai" ? C.text : C.white,
                      border: m.role === "ai" ? `1px solid ${C.border}` : undefined,
                      fontFamily: "'Noto Sans Tamil', sans-serif",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 1 && (
              <div className="px-3 py-2 flex flex-wrap gap-1.5" style={{ background: C.bg, borderTop: `1px solid ${C.border}` }}>
                {CHAT_SUGGESTIONS.map((s) => (
                  <button
                    key={s.en}
                    onClick={() => { setInput(s[lang]); }}
                    className="px-2 py-1 rounded-full text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: `${C.navy}12`, color: C.navy, border: `1px solid ${C.navy}20` }}
                  >
                    {s[lang]}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-3" style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t("typeMessage", lang)}
                className="flex-1 text-xs rounded-full px-3 py-2 outline-none"
                style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: "'Noto Sans Tamil', sans-serif" }}
              />
              <button
                onClick={send}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ background: C.orange }}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── FLOATING VOICE BUTTON ────────────────────────────────────────────────────
function FloatingVoiceButton({ lang }: { lang: Lang }) {
  const [listening, setListening] = useState(false);
  const rRef = useRef<any>(null);

  const toggle = () => {
    if (listening) {
      rRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r: any = new SR();
    r.lang = lang === "ta" ? "ta-IN" : lang === "hi" ? "hi-IN" : "en-IN";
    r.onend = () => setListening(false);
    rRef.current = r;
    r.start();
    setListening(true);
  };

  return (
    <div className="fixed bottom-24 right-24 z-50">
      {/* Pulsing rings */}
      {listening && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `3px solid ${C.orange}` }}
          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        />
      )}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        aria-label={listening ? "Stop voice assistant" : "Activate voice assistant"}
        className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-xl"
        style={{ background: listening ? "#DC2626" : C.orange, boxShadow: `0 0 24px ${C.orange}60` }}
        title={t("tapToSpeak", lang)}
      >
        <Mic className={`w-5 h-5 ${listening ? "animate-pulse" : ""}`} />
      </motion.button>
    </div>
  );
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
function AuthModal({ isOpen, onClose, lang }: { isOpen: boolean; onClose: () => void; lang: Lang }) {
  const [tab, setTab] = useState<"mobile" | "email">("mobile");
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [emailStep, setEmailStep] = useState<1 | 2>(1);
  const [emailSending, setEmailSending] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [emailOtp, setEmailOtp] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  useEffect(() => {
    if (emailCountdown > 0) {
      const t = setTimeout(() => setEmailCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [emailCountdown]);

  const sendEmailOtp = async () => {
    if (!email || !email.includes("@")) {
      alert("Please enter a valid email address");
      return;
    }
    setEmailSending(true);
    try {
      const r = await fetch(`${API_BASE}/api/auth/send-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setEmailStep(2);
        setEmailCountdown(60);
      } else {
        alert(data.detail || "Unable to send email verification code");
      }
    } catch {
      alert("Unable to reach verification server. Please check backend connection.");
    } finally {
      setEmailSending(false);
    }
  };

  const verifyEmailOtp = async () => {
    const code = emailOtp.join("");
    if (code.length !== 6) {
      alert("Please enter the 6-digit email OTP");
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/api/auth/verify-email-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.email_verified) {
        localStorage.setItem("msg_user_email", email);
        localStorage.setItem("msg_email_verified", "true");
        // If phone was also verified, exchange for dual-verified applicant session token
        const savedPhone = localStorage.getItem("msg_user_phone");
        if (savedPhone && localStorage.getItem("msg_phone_verified") === "true") {
          try {
            const sessRes = await fetch(`${API_BASE}/api/auth/verified-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone_number: savedPhone, email }),
            });
            const sData = await sessRes.json().catch(() => ({}));
            if (sData.token) localStorage.setItem("msg_applicant_token", sData.token);
          } catch { /* proceed */ }
        }
        alert("Email verified successfully! / மின்னஞ்சல் சரிபார்க்கப்பட்டது!");
        onClose();
      } else {
        alert(data.detail || "Invalid or expired OTP. Please check and retry.");
      }
    } catch {
      alert("Verification server unreachable. Please retry.");
    }
  };

  const sendOtp = async () => {
    setSending(true);
    try {
      await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: `+91${phone}` }),
      });
    } catch { /* graceful fail in demo */ }
    setStep(2);
    setCountdown(30);
    setSending(false);
  };

  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      alert("Please enter a valid 6-digit OTP");
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: `+91${phone}`, otp: code }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.phone_verified) {
        localStorage.setItem("msg_user_phone", `+91${phone}`);
        localStorage.setItem("msg_phone_verified", "true");
        // If email was already verified, attempt dual-verification session
        const savedEmail = localStorage.getItem("msg_user_email");
        if (savedEmail && localStorage.getItem("msg_email_verified") === "true") {
          try {
            const sessRes = await fetch(`${API_BASE}/api/auth/verified-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone_number: `+91${phone}`, email: savedEmail }),
            });
            const sData = await sessRes.json().catch(() => ({}));
            if (sData.token) localStorage.setItem("msg_applicant_token", sData.token);
          } catch { /* proceed */ }
        }
        alert("Mobile number verified successfully! / மொபைல் எண் வெற்றிகரமாக சரிபார்க்கப்பட்டது!");
        onClose();
      } else {
        alert(data.detail || "Invalid or expired OTP. Please try again.");
      }
    } catch {
      alert("Unable to connect to verification server. Please ensure the backend is running.");
    }
  };

  const changeOtp = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const n = [...otp]; n[i] = v.slice(-1); setOtp(n);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const val = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (val.length === 6) { setOtp(val.split("")); otpRefs.current[5]?.focus(); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(7,29,103,0.5)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="w-full max-w-md rounded-3xl p-8 relative"
            style={{ background: C.white, boxShadow: "0 24px 80px rgba(16,47,140,0.3)" }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70"
              style={{ background: C.bg }}
            >
              <X className="w-4 h-4" style={{ color: C.text }} />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <img src="/images/sahayak-logo.webp" alt="Sahayak Logo" className="w-14 h-14 rounded-2xl mx-auto mb-3 object-contain shadow-sm" />
              <h2 id="auth-modal-title" className="text-xl font-bold" style={{ color: C.text }}>
                {lang === "ta" ? "சகாயக்-இல் உள்நுழைக" : "Sign in to Sahayak"}
              </h2>
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                {lang === "ta" ? "உங்கள் அரசு திட்டங்களை அணுகவும்" : "Access your government scheme benefits"}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-2xl p-1 mb-6" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              {(["mobile", "email"] as const).map((tb) => (
                <button
                  key={tb}
                  onClick={() => { setTab(tb); setStep(1); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: tab === tb ? C.white : "transparent",
                    color: tab === tb ? C.navy : "#6B7280",
                    boxShadow: tab === tb ? "0 2px 8px rgba(16,47,140,0.1)" : undefined,
                  }}
                >
                  {tb === "mobile" ? <Smartphone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  {tb === "mobile" ? (lang === "ta" ? "மொபைல் OTP" : "Mobile OTP") : (lang === "ta" ? "மின்னஞ்சல்" : "Email")}
                </button>
              ))}
            </div>

            {/* Mobile tab */}
            {tab === "mobile" && (
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: C.text }}>
                        {lang === "ta" ? "உங்கள் மொபைல் எண்ணை உள்ளிடவும்" : "Enter your mobile number"}
                      </label>
                      <div className="flex rounded-xl overflow-hidden" style={{ border: `2px solid ${C.border}` }}>
                        <div className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ background: C.bg, borderRight: `2px solid ${C.border}` }}>
                          <span className="text-base">🇮🇳</span>
                          <span className="text-sm font-bold" style={{ color: C.text }}>+91</span>
                        </div>
                        <input
                          inputMode="numeric"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          className="flex-1 px-3 py-3 text-lg font-semibold outline-none"
                          style={{ color: C.text, background: C.white }}
                          placeholder="XXXXX XXXXX"
                        />
                        <button className="px-3" title="Voice input"><Volume2 className="w-4 h-4" style={{ color: "#9CA3AF" }} /></button>
                      </div>
                    </div>
                    <button
                      onClick={sendOtp}
                      disabled={phone.length < 10 || sending}
                      className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-opacity"
                      style={{ background: phone.length >= 10 ? C.orange : "#D1D5DB" }}
                    >
                      {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Phone className="w-4 h-4" />}
                      {lang === "ta" ? "OTP அனுப்புக" : "Send OTP"}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: "#6B7280" }}>
                        +91 {phone.slice(0,5)}XXXXX
                      </span>
                      <button onClick={() => setStep(1)} className="text-xs font-semibold" style={{ color: C.orange }}>
                        {lang === "ta" ? "எண்ணை மாற்று" : "Edit"}
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-3" style={{ color: C.text }}>
                        {lang === "ta" ? "6-இலக்க OTP உள்ளிடவும்" : "Enter 6-digit OTP"}
                      </label>
                      <div className="flex gap-2" onPaste={handleOtpPaste}>
                        {otp.map((d, i) => (
                          <input
                            key={i}
                            ref={(el) => { otpRefs.current[i] = el; }}
                            value={d}
                            onChange={(e) => changeOtp(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            maxLength={1}
                            inputMode="numeric"
                            aria-label={`Digit ${i + 1} of verification code`}
                            className="w-12 h-14 text-center text-2xl font-bold rounded-xl outline-none transition-all"
                            style={{
                              border: `2px solid ${d ? C.orange : C.border}`,
                              color: C.text,
                              background: d ? `${C.orange}08` : C.white,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "#6B7280" }}>
                        {countdown > 0 ? `${lang === "ta" ? "மீண்டும் அனுப்ப" : "Resend in"} ${countdown}s` : ""}
                      </span>
                      {countdown === 0 && (
                        <button onClick={() => { sendOtp(); }} className="font-semibold" style={{ color: C.orange }}>
                          {lang === "ta" ? "OTP மீண்டும் அனுப்புக" : "Resend OTP"}
                        </button>
                      )}
                    </div>

                    <button
                      onClick={verifyOtp}
                      disabled={otp.some((d) => !d)}
                      className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity"
                      style={{ background: otp.every(Boolean) ? C.green : "#D1D5DB" }}
                    >
                      {lang === "ta" ? "சரிபார்க்கவும் (Verify & Login)" : "Verify & Login"}
                    </button>

                    <button className="w-full py-2 text-xs font-medium flex items-center justify-center gap-1.5" style={{ color: "#6B7280" }}>
                      <Phone className="w-3.5 h-3.5" />
                      {lang === "ta" ? "அழைப்பு மூலம் OTP பெறுக" : "Get OTP via Voice Call"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Email tab */}
            {tab === "email" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Email OTP Verification */}
                {emailStep === 1 ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: C.text }}>
                        {lang === "ta" ? "உங்கள் மின்னஞ்சல் முகவரி" : "Your Email Address"}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-3 rounded-xl text-sm outline-none"
                        style={{ border: `2px solid ${C.border}`, color: C.text }}
                        placeholder="citizen@example.gov.in"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {lang === "ta" ? "தற்காலிக மின்னஞ்சல்கள் அனுமதிக்கப்படாது" : "Disposable emails will be rejected"}
                      </p>
                    </div>

                    <button
                      onClick={sendEmailOtp}
                      disabled={!email || !email.includes("@") || emailSending}
                      className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-opacity"
                      style={{ background: email.includes("@") ? C.navy : "#D1D5DB" }}
                    >
                      {emailSending ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      {lang === "ta" ? "மின்னஞ்சல் OTP அனுப்புக" : "Send Email OTP"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: "#6B7280" }}>
                        {email}
                      </span>
                      <button onClick={() => setEmailStep(1)} className="text-xs font-semibold" style={{ color: C.orange }}>
                        {lang === "ta" ? "மாற்று" : "Change"}
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-3" style={{ color: C.text }}>
                        {lang === "ta" ? "மின்னஞ்சலுக்கு அனுப்பப்பட்ட 6-இலக்க OTP" : "Enter 6-digit Email OTP"}
                      </label>
                      <div className="flex gap-2">
                        {emailOtp.map((d, i) => (
                          <input
                            key={i}
                            ref={(el) => { emailOtpRefs.current[i] = el; }}
                            value={d}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "");
                              const n = [...emailOtp];
                              n[i] = v.slice(-1);
                              setEmailOtp(n);
                              if (v && i < 5) emailOtpRefs.current[i + 1]?.focus();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !emailOtp[i] && i > 0) emailOtpRefs.current[i - 1]?.focus();
                            }}
                            maxLength={1}
                            inputMode="numeric"
                            aria-label={`Digit ${i + 1} of email code`}
                            className="w-12 h-14 text-center text-2xl font-bold rounded-xl outline-none transition-all"
                            style={{
                              border: `2px solid ${d ? C.navy : C.border}`,
                              color: C.text,
                              background: d ? `${C.navy}08` : C.white,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "#6B7280" }}>
                        {emailCountdown > 0 ? `Resend in ${emailCountdown}s` : ""}
                      </span>
                      {emailCountdown === 0 && (
                        <button onClick={sendEmailOtp} className="font-semibold" style={{ color: C.navy }}>
                          Resend OTP
                        </button>
                      )}
                    </div>

                    <button
                      onClick={verifyEmailOtp}
                      disabled={emailOtp.some((d) => !d)}
                      className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity"
                      style={{ background: emailOtp.every(Boolean) ? C.green : "#D1D5DB" }}
                    >
                      {lang === "ta" ? "சரிபார்க்கவும் (Verify Email)" : "Verify Email"}
                    </button>
                  </div>
                )}

                {/* Guest access */}
                <button onClick={onClose} className="w-full py-2 text-xs font-medium underline" style={{ color: "#6B7280" }}>
                  {lang === "ta" ? "விருந்தினராக தொடரவும்" : "Continue as Guest"}
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer({ lang }: { lang: Lang }) {
  return (
    <footer className="py-10" style={{ background: C.deepNavy }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/images/sahayak-logo.webp" alt="Sahayak Logo" className="w-10 h-10 rounded-full object-contain bg-white/10" />
              <div>
                <div className="font-bold text-white">சகாயக் | Sahayak</div>
                <div className="text-xs text-blue-200">{t("subtitle", lang)}</div>
              </div>
            </div>
            <p className="text-xs text-blue-200 leading-relaxed max-w-xs">
              {lang === "ta"
                ? "இந்திய குடிமக்களுக்கு AI-இயக்கப்படும் குரல் உதவியாளர் மூலம் அரசு திட்டங்களை அணுக உதவுகிறோம்."
                : "Helping Indian citizens access government schemes through AI-powered voice assistance."}
            </p>
          </div>
          {[
            { title: lang === "ta" ? "திட்டங்கள்" : "Schemes", links: ["PM-KISAN", "Kalaignar Thittam", "Housing Scheme", "Student Aid"] },
            { title: lang === "ta" ? "உதவி" : "Support", links: [lang === "ta" ? "தொடர்பு கொள்ள" : "Contact Us", "FAQ", lang === "ta" ? "மேலும் அறிய" : "Learn More", lang === "ta" ? "தனியுரிமை" : "Privacy"] },
          ].map(({ title, links }) => (
            <div key={title}>
              <h4 className="font-bold text-white text-sm mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l}><a href="#" className="text-xs text-blue-200 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <p className="text-xs text-blue-300">
            © 2025 Sahayak. {lang === "ta" ? "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டுள்ளன." : "All rights reserved."} | Illustrative Demo
          </p>
          <div className="flex items-center gap-1.5 text-xs text-blue-300">
            <Shield className="w-3.5 h-3.5" style={{ color: C.green }} />
            {lang === "ta" ? "அரசு அங்கீகரிக்கப்பட்ட தரவு" : "Government Authorised Data"}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────────────
export default function Sahayak() {
  const [lang, setLang] = useState<Lang>("ta");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  // Inject Noto Sans Tamil font if not present
  useEffect(() => {
    if (!document.getElementById("noto-tamil-font")) {
      const link = document.createElement("link");
      link.id = "noto-tamil-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700;900&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: "Inter, 'Noto Sans Tamil', sans-serif" }}>
      <Navbar lang={lang} setLang={setLang} onLogin={() => setAuthOpen(true)} />
      <Hero lang={lang} onSearch={(q) => setSearch(q)} />
      <TrustBar lang={lang} />
      <CategoryCards lang={lang} activeCategory={category} setCategory={setCategory} />
      <FeaturedSchemes lang={lang} search={search} activeCategory={category} onApply={() => setAuthOpen(true)} />
      <HowItWorks lang={lang} />
      <Footer lang={lang} />
      <AIChatWidget lang={lang} />
      <FloatingVoiceButton lang={lang} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} lang={lang} />
    </div>
  );
}
