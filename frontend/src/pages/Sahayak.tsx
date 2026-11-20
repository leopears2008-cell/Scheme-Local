import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AuthModal from "../components/AuthModal";
import {
  Mic,
  MicOff,
  Search,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileText,
  ChevronDown,
  X,
  Send,
  Building2,
  PhoneCall,
  ExternalLink,
  Check,
  Bookmark,
  LogIn,
  LogOut
} from "lucide-react";

// --- Types & Data ---

type Language = "ta" | "en" | "hi";

interface UserProfile {
  name: string;
  phone?: string;
  email?: string;
  district?: string;
  isGuest?: boolean;
}

interface Scheme {
  id: string;
  name: { ta: string; en: string };
  dept: { ta: string; en: string };
  level: "Central Govt" | "Tamil Nadu Govt";
  benefit: { ta: string; en: string };
  category: "farmers" | "women" | "seniors" | "students" | "msme";
  criteria: { ta: string[]; en: string[] };
  deadline: string;
  officialUrl: string;
}

const TN_DISTRICTS = [
  "சென்னை (Chennai)",
  "கோயம்புத்தூர் (Coimbatore)",
  "மதுரை (Madurai)",
  "தஞ்சாவூர் (Thanjavur)",
  "திருச்சிராப்பள்ளி (Tiruchirappalli)",
  "சேலம் (Salem)",
  "திருநெல்வேலி (Tirunelveli)",
  "ஈரோடு (Erode)",
  "வேலூர் (Vellore)",
  "திண்டுக்கல் (Dindigul)"
];

const CATEGORIES = [
  {
    id: "all",
    label: { ta: "அனைத்தும்", en: "All Schemes" },
    image: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80",
    desc: { ta: "முழு திட்டங்கள்", en: "Explore entire database" }
  },
  {
    id: "farmers",
    label: { ta: "விவசாயி", en: "Farmers" },
    image: "https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?auto=format&fit=crop&w=600&q=80",
    desc: { ta: "மானியம் & இடுபொருட்கள்", en: "Subsidies & crop safety" }
  },
  {
    id: "women",
    label: { ta: "பெண்கள்", en: "Women" },
    image: "https://images.unsplash.com/photo-1617450365226-9bf28c04e130?auto=format&fit=crop&w=600&q=80",
    desc: { ta: "மாத உதவி & தொழில்முனைவு", en: "Monthly aid & livelihoods" }
  },
  {
    id: "seniors",
    label: { ta: "முதியோர்", en: "Seniors" },
    image: "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=600&q=80",
    desc: { ta: "முதியோர் ஓய்வூதியம்", en: "Pensions & healthcare" }
  },
  {
    id: "students",
    label: { ta: "மாணவர்கள்", en: "Students" },
    image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80",
    desc: { ta: "கல்வி உதவித்தொகை & உபகரணங்கள்", en: "Scholarships & gear" }
  }
];

const SCHEMES: Scheme[] = [
  {
    id: "km-ut",
    name: {
      ta: "கலைஞர் மகளிர் உரிமைத் திட்டம்",
      en: "Kalaignar Magalir Urimai Thittam"
    },
    dept: {
      ta: "வருவாய்த் துறை, தமிழ்நாடு அரசு",
      en: "Revenue Dept, Govt of Tamil Nadu"
    },
    level: "Tamil Nadu Govt",
    benefit: {
      ta: "₹1,000 / மாதம்",
      en: "₹1,000 / month"
    },
    category: "women",
    criteria: {
      ta: [
        "21+ வயது பூர்த்தியடைந்த குடும்பத் தலைவி",
        "குடும்ப ஆண்டு வருமானம் ₹2.5 லட்சத்திற்குள்",
        "ஆதார் & மின்னணு குடும்ப அட்டை (Ration Card)"
      ],
      en: [
        "Head of the family (Female aged 21+)",
        "Annual household income under ₹2.5 Lakhs",
        "Valid Aadhaar and Smart Ration Card"
      ]
    },
    deadline: "Open All Year",
    officialUrl: "https://kmut.tn.gov.in"
  },
  {
    id: "pm-kisan",
    name: {
      ta: "பிரதமர் கிசான் சம்மான் நிதி (PM-KISAN)",
      en: "PM Kisan Samman Nidhi Yojana"
    },
    dept: {
      ta: "விவசாயம் மற்றும் உழவர் நல அமைச்சகம்",
      en: "Ministry of Agriculture & Farmers Welfare"
    },
    level: "Central Govt",
    benefit: {
      ta: "₹6,000 / ஆண்டு",
      en: "₹6,000 / year"
    },
    category: "farmers",
    criteria: {
      ta: [
        "சொந்த நிலம் வைத்துள்ள சிறு/குறு விவசாயிகள்",
        "நேரடி வங்கிப் பரிமாற்றம் (DBT) இணைக்கப்பட்ட கணக்கு",
        "நில உரிமை ஆவணங்கள் மற்றும் இ-கேஒய்சி (e-KYC)"
      ],
      en: [
        "Small & marginal landholding farmer families",
        "Aadhaar-linked active DBT bank account",
        "Valid land record documentation & e-KYC"
      ]
    },
    deadline: "Tri-annual Instalments",
    officialUrl: "https://pmkisan.gov.in"
  },
  {
    id: "cm-uzhavar",
    name: {
      ta: "முதலமைச்சரின் உழவர் பாதுகாப்புத் திட்டம்",
      en: "Chief Minister's Uzhavar Pathukappu Thittam"
    },
    dept: {
      ta: "வேளாண்மை துறை, தமிழ்நாடு அரசு",
      en: "Agriculture Dept, Govt of Tamil Nadu"
    },
    level: "Tamil Nadu Govt",
    benefit: {
      ta: "₹1,500 - ₹1,00,000 / உதவி",
      en: "₹1,500 - ₹1,00,000 / Assistance"
    },
    category: "farmers",
    criteria: {
      ta: [
        "விவசாயத் தொழிலாளர்கள் மற்றும் குத்தகைதாரர்கள்",
        "18 முதல் 65 வயது வரம்பு",
        "உழவர் பாதுகாப்பு அட்டை கட்டாயம்"
      ],
      en: [
        "Agricultural laborers & registered tenant farmers",
        "Age between 18 and 65 years",
        "Registered Farmer Social Security Card"
      ]
    },
    deadline: "Continuous Assistance",
    officialUrl: "https://tn.gov.in"
  },
  {
    id: "tn-oap",
    name: {
      ta: "முதியோர் ஓய்வூதியத் திட்டம் (Indira Gandhi OAP)",
      en: "Old Age Pension Scheme (IGNOAPS)"
    },
    dept: {
      ta: "சமூக நலம் மற்றும் மகளிர் உரிமைத் துறை",
      en: "Social Welfare & Women Empowerment Dept"
    },
    level: "Tamil Nadu Govt",
    benefit: {
      ta: "₹1,200 / மாதம்",
      en: "₹1,200 / month"
    },
    category: "seniors",
    criteria: {
      ta: [
        "60 வயது அல்லது அதற்கு மேற்பட்ட ஆதரவற்ற முதியோர்",
        "குடும்ப ஆண்டு வருமானம் ₹1 லட்சத்திற்குள்",
        "தமிழ்நாட்டில் நிரந்தர வசிப்பிடச் சான்று"
      ],
      en: [
        "Destitute senior citizen aged 60+",
        "Annual family income within ₹1.0 Lakh",
        "Domicile certificate of Tamil Nadu"
      ]
    },
    deadline: "Monthly Disbursement",
    officialUrl: "https://tn.gov.in"
  },
  {
    id: "pudhumai-penn",
    name: {
      ta: "புதுமைப் பெண் திட்டம் (மூவலூர் ராமாமிர்தம்)",
      en: "Pudhumai Penn Higher Education Scheme"
    },
    dept: {
      ta: "உயர் கல்வித் துறை, தமிழ்நாடு அரசு",
      en: "Higher Education Dept, Govt of Tamil Nadu"
    },
    level: "Tamil Nadu Govt",
    benefit: {
      ta: "₹1,000 / மாதம்",
      en: "₹1,000 / month"
    },
    category: "students",
    criteria: {
      ta: [
        "அரசுப் பள்ளியில் 6 முதல் 12-ஆம் வகுப்பு வரை பயின்ற மாணவிகள்",
        "இளங்கலை / பட்டயப் படிப்புகளில் சேர்க்கை பெற்றிருக்க வேண்டும்",
        "வங்கிக் கணக்குடன் ஆதார் எண் இணைக்கப்பட்டிருக்க வேண்டும்"
      ],
      en: [
        "Girl students studied in Govt schools (Classes 6-12)",
        "Enrolled in regular Undergraduate or Diploma degrees",
        "Bank account seeded with Aadhaar"
      ]
    },
    deadline: "Annual Academic Term",
    officialUrl: "https://penkalvi.tn.gov.in"
  },
  {
    id: "pm-svanidhi",
    name: {
      ta: "பிரதமர் ஸ்வநிதி திட்டம் (PM SVANidhi)",
      en: "PM SVANidhi Micro-Credit for Street Vendors"
    },
    dept: {
      ta: "வீட்டுவசதி மற்றும் நகர்ப்புற விவகாரங்கள் அமைச்சகம்",
      en: "Ministry of Housing and Urban Affairs"
    },
    level: "Central Govt",
    benefit: {
      ta: "₹10,000 - ₹50,000 பிணையில்லாக் கடன்",
      en: "₹10,000 - ₹50,000 Collateral-free loan"
    },
    category: "msme",
    criteria: {
      ta: [
        "நகர்ப்புற அல்லது கிராமப்புற தெருவோர வியாபாரிகள்",
        "நகராட்சி விற்பனைச் சான்றிதழ் அல்லது சிபாரிசு கடிதம்",
        "டிஜிட்டல் பரிவர்த்தனைகளுக்கு 7% வட்டி மானியம்"
      ],
      en: [
        "Street vendors in urban and peri-urban areas",
        "Urban Local Body vending certificate or LoR",
        "7% interest subsidy on digital payments"
      ]
    },
    deadline: "Rolling Applications",
    officialUrl: "https://pmsvanidhi.mohua.gov.in"
  }
];

const FAQS = [
  {
    q: {
      ta: "சகாயக் குரல் சேவை எவ்வாறு செயல்படுகிறது?",
      en: "How does the Sahayak voice search work?"
    },
    a: {
      ta: "நீங்கள் மைக்ரோஃபோன் பொத்தானை அழுத்தி, உங்கள் மொழியில் (தமிழ் அல்லது ஆங்கிலம்) நீங்கள் யார், என்ன தொழில் செய்கிறீர்கள், உங்கள் வயது அல்லது என்ன உதவி தேவை என்று பேசினால் போதும். செயற்கை நுண்ணறிவு உங்கள் தகுதியை ஆராய்ந்து பொருத்தமான மத்திய மற்றும் மாநில அரசுத் திட்டங்களை நொடியில் பட்டியலிடும்.",
      en: "Simply tap the microphone button and speak in your natural voice (Tamil or English). Tell Sahayak your occupation, age, or required assistance. Our AI parses your profile, matches verified government guidelines, and reveals your eligible schemes instantly."
    }
  },
  {
    q: {
      ta: "நான் பேசும் குரல் பதிவுகள் அல்லது ஆவணங்கள் பாதுகாக்கப்படுமா?",
      en: "Is my voice data and document information private and secure?"
    },
    a: {
      ta: "நிச்சயமாக. சகாயக் உங்கள் முழுமையான அனுமதியுடன் மட்டுமே செயல்படுகிறது. உங்கள் குரல் குறிப்புகள் தகுதி சோதனைக்குப் பிறகு சேமிக்கப்படாது. உங்கள் தனிப்பட்ட தரவுகள் மற்றும் ஆதார் விவரங்கள் உங்கள் சாதனத்திலேயே முழுமையாக என்க்ரிப்ட் செய்யப்பட்டு பாதுகாக்கப்படுகின்றன.",
      en: "Absolutely. Sahayak operates strictly on consent. Audio streams are analyzed ephemeral-only for query processing and discarded immediately. No Aadhaar numbers or personal documents are stored on unencrypted remote servers."
    }
  },
  {
    q: {
      ta: "இது அதிகாரப்பூர்வ அரசு வலைத்தளமா?",
      en: "Is this an official government application portal?"
    },
    a: {
      ta: "இது ஒரு வழிகாட்டுதல் மற்றும் தகுதி சரிபார்ப்பு தளம் (Citizen Guidance Platform). இது அரசு சார்பாக விண்ணப்பங்களை நேரடியாகச் சமர்ப்பிக்காது. மாறாக, நீங்கள் தகுதியானவரா என்பதைச் சரிபார்த்து, விண்ணப்பப் படிவங்களை முழுமையாகத் தயார் செய்து, அதிகாரப்பூர்வ அரசு போர்ட்டல்களுக்கு உங்களை வழிநடத்துகிறது.",
      en: "Sahayak is an independent public welfare guidance platform. It checks indicative eligibility, prepares your verified document drafts, and directs you directly to the official government portals without middleman commissions."
    }
  },
  {
    q: {
      ta: "இணைய வேகம் குறைவாக உள்ள கிராமப்புறங்களில் இது செயல்படுமா?",
      en: "Does it operate reliably in rural areas with low network bandwidth?"
    },
    a: {
      ta: "ஆம், சகாயக் மிகவும் குறைந்த அலைவரிசையிலும் (2G / 3G) எளிதாக இயங்கும் வகையில் வடிவமைக்கப்பட்டுள்ளது. ஆடியோ குறிப்புகள் தானாக சுருக்கப்பட்டு மிக விரைவாக விடையளிக்கும்.",
      en: "Yes, Sahayak is built with lightweight payloads optimized for 2G/3G rural networks, utilizing compressed voice packets and instant client-side rendering."
    }
  },
  {
    q: {
      ta: "விண்ணப்பிக்க என்னென்ன ஆவணங்கள் தேவைப்படும்?",
      en: "What documents are generally needed for most schemes?"
    },
    a: {
      ta: "பெரும்பாலான திட்டங்களுக்கு ஆதார் அட்டை, குடும்ப அட்டை (Ration Card), வருமானச் சான்றிதழ், வங்கி கணக்கு புத்தகம் மற்றும் நில ஆவணங்கள் (விவசாயிகளுக்கு) போதுமானது. நமது ஆவண ஸ்கேனர் மூலம் இவற்றைப் படம் எடுத்து எளிதாகப் பதிவேற்றலாம்.",
      en: "Most state and central schemes require an Aadhaar Card, Smart Ration Card, Income Certificate, Bank Passbook, and Land records (for farmers). You can snapshot and review them safely in our Document Vault."
    }
  },
  {
    q: {
      ta: "விண்ணப்பக் கட்டணம் ஏதேனும் செலுத்த வேண்டுமா?",
      en: "Is there any service fee for using Sahayak?"
    },
    a: {
      ta: "இல்லை! சகாயக் பொதுமக்களின் நலனுக்காக முற்றிலும் இலவசமாக வழங்கப்படுகிறது. இடைத்தரகர்கள் இன்றி ஒவ்வொரு ஏழை எளிய மக்களும் அரசு உதவிகளைப் பெற வேண்டும் என்பதே இதன் நோக்கம்.",
      en: "Zero fees. Sahayak is 100% free for all Indian citizens to eradicate middlemen exploitation and ensure government entitlements reach the last mile."
    }
  }
];

// --- Main Sahayak Component ---

export default function Sahayak() {
  const [lang, setLang] = useState<Language>("ta");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceQueryStatus, setVoiceQueryStatus] = useState<string>("");
  const [appliedScheme, setAppliedScheme] = useState<Scheme | null>(null);
  const [savedSchemeIds, setSavedSchemeIds] = useState<string[]>(["km-ut"]);

  // Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Chat Widget State
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    {
      sender: "bot",
      text: "வணக்கம்! நான் உங்கள் சகாயக் டிஜிட்டல் உதவியாளர். உங்களுக்கு என்ன அரசுத் திட்டம் அல்லது தகுதி விவரங்கள் அறிய வேண்டும்? தாராளமாகக் கேளுங்கள்!",
      time: "10:30 AM"
    }
  ]);

  // Open Auth Modal with optional callback action
  const openAuthModal = (onSuccessAction?: () => void) => {
    setPendingAction(() => onSuccessAction || null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  // Check auth before action
  const executeWithAuth = (action: () => void) => {
    if (user) {
      action();
    } else {
      openAuthModal(action);
    }
  };

  // Bookmark / Save Scheme Handler
  const toggleSaveScheme = (schemeId: string) => {
    executeWithAuth(() => {
      setSavedSchemeIds((prev) =>
        prev.includes(schemeId)
          ? prev.filter((id) => id !== schemeId)
          : [...prev, schemeId]
      );
    });
  };

  // Voice Recognition simulation
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      setVoiceQueryStatus("");
    } else {
      setIsListening(true);
      setVoiceQueryStatus(
        lang === "ta" ? "உங்கள் குரலைக் கேட்கிறது..." : "Listening to your voice..."
      );
      setTimeout(() => {
        setIsListening(false);
        const sampleQuery =
          lang === "ta"
            ? "நான் விவசாயி, நிலத்திற்கான அரசு மானியம் உள்ளதா?"
            : "I am a small farmer, are there subsidies for my farm?";
        setSearchQuery(sampleQuery);
        setSelectedCategory("farmers");
        setVoiceQueryStatus(
          lang === "ta"
            ? "குரல் கண்டறியப்பட்டது: 'விவசாயி நில மானியம்'"
            : "Recognized: 'Farmer land subsidy'"
        );
      }, 3200);
    }
  };

  const handleSignOut = () => {
    setUser(null);
    setAppliedScheme(null);
  };

  // Chat message send
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: userMsg, time: "Just now" }
    ]);
    setChatInput("");

    setTimeout(() => {
      let botReply = "";
      const lower = userMsg.toLowerCase();
      if (lower.includes("magalir") || lower.includes("மகளிர்") || lower.includes("உரிமை")) {
        botReply =
          lang === "ta"
            ? "கலைஞர் மகளிர் உரிமைத் திட்டத்தின் கீழ் குடும்பத் தலைவிகளுக்கு மாதம் ₹1,000 வங்கிப் பரிமாற்றம் மூலம் வழங்கப்படுகிறது. 21+ வயது மற்றும் ரேஷன் கார்டு தேவை."
            : "Under Kalaignar Magalir Urimai Thittam, eligible female heads of families receive ₹1,000/month via direct bank transfer.";
      } else if (lower.includes("kisan") || lower.includes("விவசாயி") || lower.includes("farmer")) {
        botReply =
          lang === "ta"
            ? "விவசாயிகளுக்கு PM-KISAN மூலம் ஆண்டுக்கு ₹6,000 (3 தவணைகளாக) மற்றும் உழவர் பாதுகாப்புத் திட்டம் மூலம் மருத்துவ, கல்வி உதவிகள் கிடைக்கின்றன."
            : "Eligible farmers receive ₹6,000 annually under PM-KISAN along with safety cover under the State Uzhavar Pathukappu scheme.";
      } else {
        botReply =
          lang === "ta"
            ? "உங்கள் கேள்விக்கு நன்றி. உங்கள் தகுதியைச் சரிபார்க்க உங்கள் வயது, மாவட்டம், தொழில் மற்றும் குடும்ப வருமானத்தை இங்கே பகிருங்கள்."
            : "Thank you for asking. Please provide your age, district, occupation, and approximate family income to check instant eligibility.";
      }
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: botReply, time: "Just now" }
      ]);
    }, 900);
  };

  // Filter schemes
  const filteredSchemes = SCHEMES.filter((scheme) => {
    const matchesCategory =
      selectedCategory === "all" || scheme.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === "" ||
      scheme.name.ta.toLowerCase().includes(query) ||
      scheme.name.en.toLowerCase().includes(query) ||
      scheme.benefit.ta.toLowerCase().includes(query) ||
      scheme.benefit.en.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#1c1917] font-sans antialiased selection:bg-[#EA580C] selection:text-white">
      {/* 1. GLOBAL NAVIGATION BAR (Sticky, Glassmorphic) */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#FAFAF9]/90 border-b border-stone-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
          {/* Left: Emblem & Brand */}
          <div className="flex items-center gap-3.5 flex-shrink-0 cursor-pointer">
            <div className="w-11 h-11 rounded-2xl bg-[#1E40AF] flex items-center justify-center text-white shadow-md shadow-indigo-900/10 ring-2 ring-[#1E40AF]/20">
              <Building2 className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-[#1E40AF]">
                  சகாயக்
                </span>
                <span className="text-stone-300 font-light">|</span>
                <span className="text-xl font-semibold tracking-tight text-stone-900">
                  Sahayak
                </span>
              </div>
              <p className="text-xs font-medium text-stone-500 tracking-wide uppercase">
                {lang === "ta"
                  ? "இந்திய அரசுத் திட்ட வழிகாட்டி"
                  : "National Citizen Scheme Gateway"}
              </p>
            </div>
          </div>

          {/* Center: Dynamic Search Bar & Navigation */}
          <div className="hidden md:flex items-center flex-1 max-w-xl mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === "ta"
                    ? "திட்டம், துறை அல்லது பயன்களைத் தேடுங்கள்..."
                    : "Search schemes, departments, benefits..."
                }
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-stone-200 rounded-full text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 focus:border-[#1E40AF] transition shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Language Toggle, Auth State & Support Queries */}
          <div className="flex items-center gap-3.5 flex-shrink-0">
            {/* Language Selector */}
            <div className="flex items-center bg-stone-100 p-1 rounded-full border border-stone-200 text-xs font-medium">
              <button
                onClick={() => setLang("ta")}
                className={`px-3 py-1.5 rounded-full transition ${
                  lang === "ta"
                    ? "bg-white text-[#1E40AF] font-bold shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                தமிழ்
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 rounded-full transition ${
                  lang === "en"
                    ? "bg-white text-[#1E40AF] font-bold shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                ENG
              </button>
              <button
                onClick={() => setLang("hi")}
                className={`px-3 py-1.5 rounded-full transition ${
                  lang === "hi"
                    ? "bg-white text-[#1E40AF] font-bold shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                हिन्दी
              </button>
            </div>

            {/* Login Button or User Profile Badge */}
            {!user ? (
              <button
                onClick={() => openAuthModal()}
                className="flex items-center gap-2 bg-white hover:bg-stone-50 text-[#1E40AF] border border-[#1E40AF]/30 text-xs sm:text-sm font-bold px-4 py-2 rounded-full shadow-xs transition hover:border-[#1E40AF] active:scale-98"
              >
                <LogIn className="w-4 h-4 text-[#EA580C]" />
                <span>{lang === "ta" ? "உள்நுழைக | Login" : "Login | Sign Up"}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 py-1 px-3 rounded-full">
                <div className="w-7 h-7 rounded-full bg-[#1E40AF] text-white flex items-center justify-center text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-[#1E40AF] leading-none">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-stone-500 leading-none mt-0.5">
                    {user.phone || user.email || (user.isGuest ? "Guest Access" : "Citizen")}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  title={lang === "ta" ? "வெளியேறுக" : "Sign Out"}
                  className="ml-1 text-stone-400 hover:text-red-600 p-1 rounded-full transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Support Queries Button */}
            <button
              onClick={() => setIsChatOpen(true)}
              className="hidden xl:flex items-center gap-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full shadow-md shadow-blue-900/10 transition active:scale-98"
            >
              <PhoneCall className="w-4 h-4 text-amber-300" />
              <span>{lang === "ta" ? "உதவி மையம்" : "Support"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION (Voice-First Command Center) */}
      <section className="relative w-full overflow-hidden pt-12 pb-20 px-6 lg:px-8 border-b border-stone-200/60 bg-gradient-to-b from-[#FAFAF9] via-amber-50/30 to-[#FAFAF9]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-amber-200/25 to-blue-200/25 blur-3xl -z-10 pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#1E40AF] text-xs font-semibold uppercase tracking-wider mb-6 shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 text-[#1E40AF]" />
            <span>
              {lang === "ta"
                ? "அரசு அங்கீகாரம் பெற்ற நேரடி சேவை"
                : "Official Citizen Entitlements Gateway"}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1E40AF] tracking-tight leading-tight max-w-4xl"
          >
            {lang === "ta"
              ? "உங்கள் தகுதியை நொடியில் கண்டறியுங்கள்!"
              : "Discover your eligibility in seconds!"}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-base sm:text-lg text-stone-600 max-w-2xl font-normal"
          >
            {lang === "ta"
              ? "இடைத்தரகர்கள் இன்றி, உங்கள் சொந்த மொழியில் பேசி மத்திய மற்றும் மாநில அரசின் நிதி உதவிகளையும் திட்டங்களையும் உடனே தெரிந்துகொள்ளுங்கள்."
              : "Voice-driven public scheme matching in your regional language. Speak freely to unlock central and state government welfare funds."}
          </motion.p>

          <div className="mt-10 flex flex-col items-center justify-center relative">
            <div className="relative flex items-center justify-center">
              {isListening && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.45, 1.7], opacity: [0.6, 0.3, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="absolute w-44 h-44 rounded-full bg-[#EA580C]/20 pointer-events-none"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.25, 1.4], opacity: [0.7, 0.4, 0] }}
                    transition={{ repeat: Infinity, duration: 2, delay: 0.4, ease: "easeInOut" }}
                    className="absolute w-36 h-36 rounded-full bg-[#EA580C]/30 pointer-events-none"
                  />
                </>
              )}

              <button
                onClick={toggleListening}
                aria-label="Tap to speak"
                className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-300 transform active:scale-95 ${
                  isListening
                    ? "bg-red-600 shadow-red-500/40 ring-8 ring-red-400/30"
                    : "bg-[#EA580C] hover:bg-[#D94F04] shadow-orange-600/30 ring-8 ring-amber-500/20 hover:scale-105"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-12 h-12 stroke-[2.2] animate-pulse" />
                ) : (
                  <Mic className="w-12 h-12 stroke-[2.2]" />
                )}
                <span className="text-[11px] font-bold tracking-wider uppercase mt-1">
                  {isListening ? "Listening" : "Speak"}
                </span>
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center gap-1.5">
              <span className="text-base sm:text-lg font-bold text-[#EA580C]">
                {lang === "ta" ? "பேச இங்கே அழுத்தவும்" : "Tap to Speak"}
              </span>
              <p className="text-xs text-stone-500 font-medium">
                {voiceQueryStatus ||
                  (lang === "ta"
                    ? "உதாரணம்: 'நான் 2 ஏக்கர் வைத்துள்ள விவசாயி, எனக்கு என்ன உதவி கிடைக்கும்?'"
                    : "Example: 'I am a farmer with 2 acres, what schemes can I get?'")}
              </p>
            </div>

            <div className="mt-8 w-full max-w-2xl px-4">
              <div className="relative flex items-center shadow-lg rounded-full bg-white border border-stone-200/90 overflow-hidden p-1.5 focus-within:ring-2 focus-within:ring-[#1E40AF]/30 focus-within:border-[#1E40AF] transition">
                <div className="pl-4 text-stone-400">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    lang === "ta"
                      ? "அல்லது தட்டச்சு செய்து தேடலாம் (எ.கா: மகளிர் உரிமை, PM Kisan, கல்வி)..."
                      : "Or type your scheme query here (e.g., Magalir, PM Kisan, Education)..."
                  }
                  className="w-full px-4 py-3 bg-transparent text-sm sm:text-base text-stone-900 placeholder:text-stone-400 focus:outline-none"
                />
                <button
                  onClick={() => {}}
                  className="bg-[#1E40AF] hover:bg-[#1E3A8A] text-white text-xs sm:text-sm font-semibold px-6 py-3 rounded-full transition flex items-center gap-1.5 flex-shrink-0"
                >
                  <span>{lang === "ta" ? "தேடுங்கள்" : "Search"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DYNAMIC CATEGORY CARDS (Quick Filters) */}
      <section className="py-14 px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-bold text-[#EA580C] uppercase tracking-widest">
              {lang === "ta" ? "விரைவு வடிகட்டிகள்" : "Quick Classification"}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
              {lang === "ta"
                ? "பிரிவுகள் மூலம் தகுதியைத் தேர்ந்தெடுக்கவும்"
                : "Browse Schemes by Target Category"}
            </h2>
          </div>
          <p className="text-sm text-stone-500 max-w-md">
            {lang === "ta"
              ? "உங்கள் வாழ்க்கை சூழலுக்குப் பொருத்தமான அரசு சலுகைகளை ஒரு கிளிக்கில் கண்டறியுங்கள்."
              : "Filter entitlements tailored specifically for your occupation and demographic."}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <motion.div
                key={cat.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedCategory(cat.id)}
                className={`group relative h-56 rounded-2xl overflow-hidden cursor-pointer shadow-md transition-all ${
                  isSelected
                    ? "ring-4 ring-[#EA580C] shadow-xl"
                    : "hover:shadow-xl ring-1 ring-stone-200"
                }`}
              >
                <img
                  src={cat.image}
                  alt={cat.label.en}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-[#EA580C] text-white p-1 rounded-full shadow-md">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="text-lg font-bold tracking-tight text-white flex items-center justify-between">
                    <span>{cat.label[lang === "ta" ? "ta" : "en"]}</span>
                  </h3>
                  <p className="text-xs text-stone-300 mt-1 font-normal line-clamp-1">
                    {cat.desc[lang === "ta" ? "ta" : "en"]}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 4. MANDATORY TAGLINE REVEAL SECTION */}
      <section className="py-16 px-6 lg:px-8 bg-white border-y border-stone-200/70">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs uppercase font-bold tracking-widest text-[#1E40AF] mb-3">
            {lang === "ta" ? "சகாயக் வாக்குறுதி" : "Our Core Mission"}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 tracking-tight leading-snug">
            {lang === "ta"
              ? "ஒவ்வொரு ஏழை எளிய குடிமகனுக்கும் அரசின் உரிமைகள் தடையின்றி சென்றடைய வேண்டும்."
              : "Every citizen deserves seamless, transparent access to their rightful government entitlements."}
          </h2>
          <div className="mt-8 flex flex-wrap justify-center items-center gap-8 text-stone-600 text-sm font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{lang === "ta" ? "இடைத்தரகர் இல்லாதது" : "100% Direct to Beneficiary"}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{lang === "ta" ? "குரல்வழி ஆவண சரிபார்ப்பு" : "Voice-driven Eligibility Engine"}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{lang === "ta" ? "பாதுகாப்பான உள்ளூர் களஞ்சியம்" : "Encrypted Local Privacy Vault"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FEATURED SCHEMES GRID (Results Dashboard) */}
      <section className="py-16 px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-100 text-[#EA580C] text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === "ta" ? "நேரடி பலன்கள்" : "Financial Relief"}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-[#1E40AF]">
              Featured Schemes (மத்திய & மாநில அரசு)
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              {lang === "ta"
                ? `கிடைக்கப்பெற்ற தகுதியான திட்டங்கள் (${filteredSchemes.length})`
                : `Verified active government benefit programs (${filteredSchemes.length})`}
            </p>
          </div>

          {selectedCategory !== "all" && (
            <button
              onClick={() => setSelectedCategory("all")}
              className="text-xs text-[#EA580C] font-semibold hover:underline flex items-center gap-1"
            >
              <span>{lang === "ta" ? "அனைத்து திட்டங்களையும் காட்டு" : "Reset category filter"}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchemes.map((scheme) => {
            const isSaved = savedSchemeIds.includes(scheme.id);
            return (
              <motion.div
                key={scheme.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-stone-200/90 shadow-md hover:shadow-xl p-6 flex flex-col justify-between transition-all relative"
              >
                <div>
                  {/* Top Bar: Scheme Name, Level Badge & Bookmark Button */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="pr-2">
                      <h3 className="text-lg font-bold text-stone-900 leading-snug">
                        {scheme.name[lang === "ta" ? "ta" : "en"]}
                      </h3>
                      <p className="text-xs text-stone-500 mt-1 font-medium">
                        {scheme.dept[lang === "ta" ? "ta" : "en"]}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Save Scheme / Bookmark Button */}
                      <button
                        onClick={() => toggleSaveScheme(scheme.id)}
                        title={
                          isSaved
                            ? lang === "ta" ? "சேமிக்கப்பட்டது" : "Saved"
                            : lang === "ta" ? "திட்டத்தைச் சேமிக்கவும்" : "Save Scheme"
                        }
                        className={`p-2 rounded-xl transition ${
                          isSaved
                            ? "bg-amber-100 text-[#EA580C]"
                            : "bg-stone-100 text-stone-400 hover:text-stone-700"
                        }`}
                      >
                        <Bookmark
                          className={`w-4 h-4 ${isSaved ? "fill-[#EA580C]" : ""}`}
                        />
                      </button>

                      {/* Govt Badge */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border shadow-xs ${
                          scheme.level === "Tamil Nadu Govt"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        }`}
                      >
                        {scheme.level}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Exact Financial Benefit */}
                  <div className="mt-5 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                      {lang === "ta" ? "நேரடி உதவித்தொகை" : "Direct Benefit"}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                      {scheme.benefit[lang === "ta" ? "ta" : "en"]}
                    </span>
                  </div>

                  {/* Checklist: 2-3 bullet points */}
                  <div className="mt-5 space-y-2.5">
                    <span className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                      {lang === "ta" ? "தகுதி நிபந்தனைகள்:" : "Eligibility Criteria:"}
                    </span>
                    {scheme.criteria[lang === "ta" ? "ta" : "en"].map((crit, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-stone-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{crit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom: Full-Width Terracotta Orange CTA Button */}
                <div className="mt-6 pt-4 border-t border-stone-100">
                  <button
                    onClick={() => {
                      executeWithAuth(() => {
                        setAppliedScheme(scheme);
                      });
                    }}
                    className="w-full bg-[#EA580C] hover:bg-[#D94F04] text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-orange-700/10 transition flex items-center justify-center gap-2 active:scale-98"
                  >
                    <span>{lang === "ta" ? "விண்ணப்பிக்கவும்" : "Apply Now"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
                    <span>{scheme.deadline}</span>
                    <a
                      href={scheme.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[#1E40AF] inline-flex items-center gap-1"
                    >
                      <span>{lang === "ta" ? "அரசு தளம்" : "Official Portal"}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 6. HOW IT WORKS */}
      <section className="py-16 px-6 lg:px-8 bg-stone-100/60 border-t border-stone-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-[#1E40AF] uppercase tracking-widest">
              {lang === "ta" ? "எளிய மூன்று படிகள்" : "3-Step Citizen Flow"}
            </span>
            <h2 className="text-3xl font-extrabold text-stone-900 mt-1">
              {lang === "ta" ? "சகாயக் எவ்வாறு செயல்படுகிறது?" : "How Sahayak Guides You"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm relative">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-[#EA580C] font-extrabold flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">
                {lang === "ta" ? "குரலில் பேசுங்கள்" : "Speak in Your Language"}
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                {lang === "ta"
                  ? "மைக்ரோஃபோனைத் தட்டி உங்கள் சொந்தக் குரலில் பேசுங்கள். உங்கள் தேவைகளை சகாயக் புரிந்துகொள்ளும்."
                  : "Tap the microphone and describe your current family occupation or welfare requirements naturally."}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm relative">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-[#1E40AF] font-extrabold flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">
                {lang === "ta" ? "தகுதி சரிபார்ப்பு" : "Instant Rule Verification"}
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                {lang === "ta"
                  ? "வயது, வருமானம், குடும்ப அட்டை மற்றும் நில ஆவணங்களின் அடிப்படையில் உடனடி தகுதி பட்டியல் திரையிடப்படும்."
                  : "Rules are matched against Tamil Nadu and Central gazette conditions to show exact matches and amounts."}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm relative">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">
                {lang === "ta" ? "விண்ணப்ப வரைவு" : "Prepare Draft & Apply"}
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed">
                {lang === "ta"
                  ? "அதிகாரப்பூர்வ விண்ணப்பப் படிவத்தை நிரப்பி, தேவையான ஆவணங்களுடன் போர்ட்டலில் விண்ணப்பிக்கலாம்."
                  : "Get pre-filled official application forms and jump directly to verified department portals."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS */}
      <section className="py-16 px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-[#EA580C] uppercase tracking-widest">
            {lang === "ta" ? "சந்தேகங்கள் & பதில்கள்" : "Common Inquiries"}
          </span>
          <h2 className="text-3xl font-extrabold text-stone-900 mt-1">
            {lang === "ta" ? "அடிக்கடி கேட்கப்படும் கேள்விகள்" : "Frequently Asked Questions"}
          </h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => (
            <details
              key={index}
              className="group bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs transition open:shadow-md"
            >
              <summary className="font-bold text-base text-stone-900 cursor-pointer list-none flex items-center justify-between">
                <span>{faq.q[lang === "ta" ? "ta" : "en"]}</span>
                <ChevronDown className="w-5 h-5 text-stone-400 group-open:rotate-180 transition-transform duration-200" />
              </summary>
              <p className="mt-3 text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
                {faq.a[lang === "ta" ? "ta" : "en"]}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 8. AUTHENTICATION MODAL (Mobile OTP + Email Sign-Up) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onLoginSuccess={(citizen) => {
          setUser(citizen);
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
      />

      {/* 9. APPLICATION GUIDANCE MODAL (When clicking Apply) */}
      <AnimatePresence>
        {appliedScheme && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 relative"
            >
              <button
                onClick={() => setAppliedScheme(null)}
                className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>

              <span className="text-xs font-bold text-[#EA580C] uppercase tracking-wider">
                {lang === "ta" ? "விண்ணப்ப வழிகாட்டுதல்" : "Application Guidance"}
              </span>
              <h3 className="text-xl font-bold text-stone-900 mt-1">
                {appliedScheme.name[lang === "ta" ? "ta" : "en"]}
              </h3>
              <p className="text-emerald-600 font-extrabold text-lg mt-1">
                {appliedScheme.benefit[lang === "ta" ? "ta" : "en"]}
              </p>

              <div className="mt-4 p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-2">
                <p className="font-semibold text-stone-800">
                  {lang === "ta" ? "தேவையான ஆவணங்கள்:" : "Prerequisite Documents:"}
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>ஆதார் அட்டை (Aadhaar Card)</li>
                  <li>மின்னணு குடும்ப அட்டை (Smart Ration Card)</li>
                  <li>வங்கி கணக்கு புத்தகம் (Bank Passbook)</li>
                </ul>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <a
                  href={appliedScheme.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-[#EA580C] hover:bg-[#D94F04] text-white font-bold py-3 px-4 rounded-xl shadow-md text-center flex items-center justify-center gap-2"
                >
                  <span>{lang === "ta" ? "அதிகாரப்பூர்வ தளத்தில் விண்ணப்பிக்க" : "Proceed to Official Portal"}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setAppliedScheme(null)}
                  className="w-full py-2.5 text-stone-500 font-semibold text-xs hover:text-stone-800"
                >
                  {lang === "ta" ? "மூடுக" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 10. FLOATING AI ASSISTANT WIDGET */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="mb-4 w-[360px] sm:w-[400px] h-[520px] bg-white rounded-3xl shadow-2xl border border-stone-200/90 flex flex-col overflow-hidden backdrop-blur-md"
            >
              <div className="bg-[#1E40AF] p-4 text-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-400 text-[#1E40AF] flex items-center justify-center font-bold shadow-xs">
                    <Sparkles className="w-5 h-5 text-indigo-900" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">சகாயக் AI உதவியாளர்</h4>
                    <span className="text-[11px] text-blue-200 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                      இணைப்பில் உள்ளார் (Online)
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-blue-200 hover:text-white p-1 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAFAF9]">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      m.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                        m.sender === "user"
                          ? "bg-[#EA580C] text-white rounded-br-xs shadow-xs"
                          : "bg-white text-stone-800 border border-stone-200/90 rounded-bl-xs shadow-xs"
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-stone-400 mt-1 px-1">
                      {m.time}
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-3 py-1.5 bg-stone-50 border-t border-stone-200/60 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                <button
                  onClick={() => setChatInput("மகளிர் உரிமைத் தொகை பற்றி கூறுங்கள்")}
                  className="px-2.5 py-1 bg-white border border-stone-200 rounded-full text-stone-700 whitespace-nowrap hover:border-[#1E40AF]"
                >
                  மகளிர் உரிமை
                </button>
                <button
                  onClick={() => setChatInput("விவசாயிகள் மானியம் என்ன உள்ளது?")}
                  className="px-2.5 py-1 bg-white border border-stone-200 rounded-full text-stone-700 whitespace-nowrap hover:border-[#1E40AF]"
                >
                  விவசாயி மானியம்
                </button>
                <button
                  onClick={() => setChatInput("முதியோர் உதவித்தொகை தகுதி என்ன?")}
                  className="px-2.5 py-1 bg-white border border-stone-200 rounded-full text-stone-700 whitespace-nowrap hover:border-[#1E40AF]"
                >
                  முதியோர் பென்ஷன்
                </button>
              </div>

              <div className="p-3 bg-white border-t border-stone-200 flex items-center gap-2">
                <button
                  onClick={toggleListening}
                  className={`p-2.5 rounded-full transition ${
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-amber-100 text-[#EA580C] hover:bg-amber-200"
                  }`}
                  title="Speak into chat"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="கேள்வியைத் தட்டச்சு செய்க..."
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-full px-3.5 py-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#1E40AF]"
                />
                <button
                  onClick={handleSendMessage}
                  className="p-2 bg-[#1E40AF] text-white rounded-full hover:bg-[#1E3A8A] transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 rounded-full bg-[#1E40AF] text-white shadow-xl flex items-center justify-center ring-4 ring-blue-500/20 hover:bg-[#1E3A8A] transition"
        >
          {isChatOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Sparkles className="w-6 h-6 text-amber-300" />
          )}
        </motion.button>
      </div>

      {/* 11. OFFICIAL FOOTER */}
      <footer className="w-full bg-stone-900 text-stone-400 py-12 px-6 lg:px-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1E40AF] flex items-center justify-center text-amber-300 font-bold">
              ச
            </div>
            <div>
              <span className="text-stone-200 font-bold text-sm">சகாயக் | Sahayak</span>
              <p className="text-stone-500">Citizen Welfare Scheme Portal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-stone-400">
            <a href="#schemes" className="hover:text-white transition">திட்டங்கள் (Schemes)</a>
            <a href="#eligibility" className="hover:text-white transition">தகுதி விதிகள் (Eligibility)</a>
            <a href="#privacy" className="hover:text-white transition">தனியுரிமைக் கொள்கை (Privacy)</a>
            <a href="#help" className="hover:text-white transition">உதவி மையம் (Helpline: 1800-425-1000)</a>
          </div>

          <p className="text-stone-600">
            © 2026 Sahayak Initiative. Designed for Indian Citizens.
          </p>
        </div>
      </footer>
    </div>
  );
}
