import en from "../locales/en.json"; import hi from "../locales/hi.json"; import bn from "../locales/bn.json"; import te from "../locales/te.json";
import mr from "../locales/mr.json"; import ta from "../locales/ta.json"; import gu from "../locales/gu.json"; import kn from "../locales/kn.json";
import ml from "../locales/ml.json"; import pa from "../locales/pa.json"; import or_ from "../locales/or.json"; import as_ from "../locales/as.json"; import ur from "../locales/ur.json";

export const LANGS = [
  { code: "en", script: "English" }, { code: "hi", script: "हिन्दी" }, { code: "ta", script: "தமிழ்" }, { code: "bn", script: "বাংলা" },
  { code: "te", script: "తెలుగు" }, { code: "mr", script: "मराठी" }, { code: "gu", script: "ગુજરાતી" }, { code: "kn", script: "ಕನ್ನಡ" },
  { code: "ml", script: "മലയാളം" }, { code: "pa", script: "ਪੰਜਾਬੀ" }, { code: "or", script: "ଓଡ଼ିଆ" }, { code: "as", script: "অসমীয়া" }, { code: "ur", script: "اردو" },
];
/** BCP-47 tags for the browser's speech APIs. */
export const SPEECH_TAG: Record<string, string> = { en: "en-IN", hi: "hi-IN", ta: "ta-IN", bn: "bn-IN", te: "te-IN", mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN", or: "or-IN", as: "as-IN", ur: "ur-IN" };

// FormSaathi's 13 locale files supply category / status / docType / nav labels in every language.
const shared: Record<string, any> = { en, hi, bn, te, mr, ta, gu, kn, ml, pa, or: or_, as: as_, ur };

// App strings: complete in English, Hindi and Tamil; other languages fall back to English (or translate via /api/translate).
const app: Record<string, Record<string, string>> = {
  en: { sahayak: "🎙️ Sahayak", talk: "Talk", find: "Find", check: "Check", docs: "Documents", apply: "Apply", track: "Track",
    tagline: "Your Voice. Your Benefits. Your Future.", askPlaceholder: "Ask about any scheme, in your language…", send: "Send", mic: "Speak", listening: "Listening…",
    searchPlaceholder: "Search schemes by name, benefit or department…", allCategories: "All categories", allStates: "Central + all states", results: "schemes",
    bookmark: "Save", saved: "Saved", details: "Details", eligibility: "Eligibility", benefits: "Benefits", howToApply: "How to apply", docsNeeded: "Documents needed",
    official: "Official source", verified: "✓ Verified", needs_review: "Needs review", unverified: "Unverified – check the official site", expired: "Expired – re-check the official site", imported: "Imported – verify on the official site", lastVerified: "Last verified",
    ELIGIBLE: "Eligible", POSSIBLE_MATCH: "Possible match", NEEDS_VERIFICATION: "Needs more info", NOT_ELIGIBLE: "Not eligible",
    POSSIBLE_HINT: "You pass the checks we can run. Read the written eligibility below to confirm.",
    yourDetails: "Your details", checkNow: "Find my schemes", age: "Age", gender: "Gender", occupation: "Occupation", income: "Annual family income (₹)", state: "State",
    category: "Category", land: "Farm land (hectares)", fullName: "Full name", dob: "Date of birth", phone: "Mobile", address: "Address", district: "District", pincode: "Pincode",
    aadhaar: "Aadhaar number", bank: "Bank account", ifsc: "IFSC", male: "Male", female: "Female", other: "Other",
    scanDoc: "Scan a document", scanHint: "Photo of Aadhaar, PAN, income certificate, passbook… We read it and fill your details.", reading: "Reading…",
    vaultNote: "Your details and document photos are encrypted and stay on this device only.", applyUseDetails: "Fill from my details",
    officialForm: "Download official form (filled)", summaryPdf: "Download my application summary", scanOwn: "Scan another form", overlayPdf: "Download filled scanned form",
    trackIt: "Track this application", status: "Status", noApps: "No applications yet.", notifications: "Notifications", markRead: "Mark all read", followUp: "Was this helpful?",
    confidence: "Confidence", checklist: "Documents checklist", common: "Carry for all", noFormFor: "No blank form is bundled for this scheme – use the summary PDF.",
    nonLatinNote: "Some values aren't in English letters, so they were left out of the official form. Use the summary PDF for those.", readAloud: "Read aloud", stop: "Stop",
    draft: "Draft", submitted: "Submitted", under_review: "Under review", need_documents: "Documents needed", approved: "Approved", rejected: "Rejected", refNo: "Reference number",
    welcome: "Ask by voice or text. We'll find schemes you may qualify for, with official sources.", errBusy: "Please try again in a moment.", clear: "Clear my data",
  },
  hi: { sahayak: "🎙️ सहायक", talk: "बात करें", find: "खोजें", check: "जाँचें", docs: "दस्तावेज़", apply: "आवेदन", track: "ट्रैक",
    tagline: "आपकी आवाज़। आपके लाभ। आपका भविष्य।", askPlaceholder: "अपनी भाषा में किसी भी योजना के बारे में पूछें…", send: "भेजें", mic: "बोलें", listening: "सुन रहे हैं…",
    searchPlaceholder: "नाम, लाभ या विभाग से योजना खोजें…", allCategories: "सभी श्रेणियाँ", allStates: "केंद्र + सभी राज्य", results: "योजनाएँ",
    bookmark: "सहेजें", saved: "सहेजा", details: "विवरण", eligibility: "पात्रता", benefits: "लाभ", howToApply: "आवेदन कैसे करें", docsNeeded: "ज़रूरी दस्तावेज़",
    official: "आधिकारिक स्रोत", verified: "✓ सत्यापित", needs_review: "समीक्षा बाकी", unverified: "असत्यापित – आधिकारिक साइट पर जाँचें", expired: "समाप्त – आधिकारिक साइट पर दोबारा जाँचें", imported: "आयातित – आधिकारिक साइट पर जाँचें", lastVerified: "अंतिम सत्यापन",
    ELIGIBLE: "पात्र", POSSIBLE_MATCH: "संभावित", NEEDS_VERIFICATION: "और जानकारी चाहिए", NOT_ELIGIBLE: "पात्र नहीं",
    POSSIBLE_HINT: "आप हमारी जाँचें पास करते हैं। पुष्टि के लिए नीचे लिखी पात्रता पढ़ें।",
    yourDetails: "आपका विवरण", checkNow: "मेरी योजनाएँ खोजें", age: "आयु", gender: "लिंग", occupation: "व्यवसाय", income: "वार्षिक पारिवारिक आय (₹)", state: "राज्य",
    category: "श्रेणी", land: "खेती की ज़मीन (हेक्टेयर)", fullName: "पूरा नाम", dob: "जन्म तिथि", phone: "मोबाइल", address: "पता", district: "ज़िला", pincode: "पिनकोड",
    aadhaar: "आधार नंबर", bank: "बैंक खाता", ifsc: "IFSC", male: "पुरुष", female: "महिला", other: "अन्य",
    scanDoc: "दस्तावेज़ स्कैन करें", scanHint: "आधार, पैन, आय प्रमाणपत्र, पासबुक की फ़ोटो… हम पढ़कर आपका विवरण भर देंगे।", reading: "पढ़ रहे हैं…",
    vaultNote: "आपका विवरण और दस्तावेज़ की फ़ोटो एन्क्रिप्टेड हैं और सिर्फ़ इसी डिवाइस पर रहती हैं।", applyUseDetails: "मेरे विवरण से भरें",
    officialForm: "आधिकारिक फ़ॉर्म (भरा हुआ) डाउनलोड करें", summaryPdf: "मेरे आवेदन का सारांश डाउनलोड करें", scanOwn: "दूसरा फ़ॉर्म स्कैन करें", overlayPdf: "भरा हुआ स्कैन फ़ॉर्म डाउनलोड करें",
    trackIt: "इस आवेदन को ट्रैक करें", status: "स्थिति", noApps: "अभी कोई आवेदन नहीं।", notifications: "सूचनाएँ", markRead: "सब पढ़ा हुआ करें", followUp: "क्या यह उपयोगी था?",
    confidence: "भरोसा", checklist: "दस्तावेज़ सूची", common: "सभी के लिए ले जाएँ", noFormFor: "इस योजना का खाली फ़ॉर्म उपलब्ध नहीं – सारांश PDF उपयोग करें।",
    nonLatinNote: "कुछ मान अंग्रेज़ी अक्षरों में नहीं हैं, इसलिए आधिकारिक फ़ॉर्म में नहीं भरे गए। उनके लिए सारांश PDF उपयोग करें।", readAloud: "सुनें", stop: "रोकें",
    draft: "ड्राफ़्ट", submitted: "जमा किया", under_review: "समीक्षा में", need_documents: "दस्तावेज़ चाहिए", approved: "स्वीकृत", rejected: "अस्वीकृत", refNo: "संदर्भ संख्या",
    welcome: "बोलकर या लिखकर पूछें। हम आपके लिए योजनाएँ आधिकारिक स्रोतों के साथ खोजेंगे।", errBusy: "कृपया थोड़ी देर बाद कोशिश करें।", clear: "मेरा डेटा मिटाएँ",
  },
  ta: { sahayak: "🎙️ சகாயக்", talk: "பேசுங்கள்", find: "தேடு", check: "சரிபார்", docs: "ஆவணங்கள்", apply: "விண்ணப்பம்", track: "கண்காணி",
    tagline: "உங்கள் குரல். உங்கள் நலன்கள். உங்கள் எதிர்காலம்.", askPlaceholder: "எந்தத் திட்டத்தைப் பற்றியும் உங்கள் மொழியில் கேளுங்கள்…", send: "அனுப்பு", mic: "பேசு", listening: "கேட்கிறோம்…",
    searchPlaceholder: "பெயர், பலன் அல்லது துறை மூலம் தேடுங்கள்…", allCategories: "அனைத்து வகைகள்", allStates: "மத்திய + அனைத்து மாநிலங்கள்", results: "திட்டங்கள்",
    bookmark: "சேமி", saved: "சேமித்தது", details: "விவரங்கள்", eligibility: "தகுதி", benefits: "பலன்கள்", howToApply: "எப்படி விண்ணப்பிப்பது", docsNeeded: "தேவையான ஆவணங்கள்",
    official: "அதிகாரப்பூர்வ மூலம்", verified: "✓ சரிபார்க்கப்பட்டது", needs_review: "மதிப்பாய்வு தேவை", unverified: "சரிபார்க்கப்படவில்லை – அதிகாரப்பூர்வ தளத்தில் பார்க்கவும்", expired: "காலாவதியானது – மீண்டும் சரிபார்க்கவும்", imported: "இறக்குமதி – அதிகாரப்பூர்வ தளத்தில் சரிபார்க்கவும்", lastVerified: "கடைசி சரிபார்ப்பு",
    ELIGIBLE: "தகுதி உண்டு", POSSIBLE_MATCH: "பொருந்தலாம்", NEEDS_VERIFICATION: "மேலும் தகவல் தேவை", NOT_ELIGIBLE: "தகுதி இல்லை",
    POSSIBLE_HINT: "நாங்கள் சரிபார்க்கக்கூடியவற்றில் நீங்கள் தேர்ச்சி பெறுகிறீர்கள். உறுதிசெய்ய கீழே உள்ள தகுதியைப் படியுங்கள்.",
    yourDetails: "உங்கள் விவரங்கள்", checkNow: "என் திட்டங்களைக் கண்டுபிடி", age: "வயது", gender: "பாலினம்", occupation: "தொழில்", income: "ஆண்டு குடும்ப வருமானம் (₹)", state: "மாநிலம்",
    category: "பிரிவு", land: "விவசாய நிலம் (ஹெக்டேர்)", fullName: "முழுப் பெயர்", dob: "பிறந்த தேதி", phone: "கைபேசி", address: "முகவரி", district: "மாவட்டம்", pincode: "அஞ்சல் குறியீடு",
    aadhaar: "ஆதார் எண்", bank: "வங்கிக் கணக்கு", ifsc: "IFSC", male: "ஆண்", female: "பெண்", other: "மற்றவை",
    scanDoc: "ஆவணத்தை ஸ்கேன் செய்", scanHint: "ஆதார், பான், வருமானச் சான்று, பாஸ்புக் படம்… நாங்கள் படித்து உங்கள் விவரங்களை நிரப்புவோம்.", reading: "படிக்கிறோம்…",
    vaultNote: "உங்கள் விவரங்களும் ஆவணப் படங்களும் குறியாக்கம் செய்யப்பட்டு இந்தச் சாதனத்திலேயே இருக்கும்.", applyUseDetails: "என் விவரங்களிலிருந்து நிரப்பு",
    officialForm: "அதிகாரப்பூர்வ படிவம் (நிரப்பியது) பதிவிறக்கு", summaryPdf: "என் விண்ணப்பச் சுருக்கத்தைப் பதிவிறக்கு", scanOwn: "வேறு படிவத்தை ஸ்கேன் செய்", overlayPdf: "நிரப்பிய ஸ்கேன் படிவத்தைப் பதிவிறக்கு",
    trackIt: "இந்த விண்ணப்பத்தைக் கண்காணி", status: "நிலை", noApps: "இன்னும் விண்ணப்பங்கள் இல்லை.", notifications: "அறிவிப்புகள்", markRead: "அனைத்தும் படித்தது", followUp: "இது உதவியதா?",
    confidence: "நம்பகத்தன்மை", checklist: "ஆவணப் பட்டியல்", common: "அனைத்திற்கும் கொண்டு செல்லவும்", noFormFor: "இந்தத் திட்டத்திற்கு வெற்றுப் படிவம் இல்லை – சுருக்க PDF ஐப் பயன்படுத்தவும்.",
    nonLatinNote: "சில மதிப்புகள் ஆங்கில எழுத்தில் இல்லாததால் அதிகாரப்பூர்வ படிவத்தில் சேர்க்கப்படவில்லை. அவற்றுக்கு சுருக்க PDF ஐப் பயன்படுத்தவும்.", readAloud: "வாசி", stop: "நிறுத்து",
    draft: "வரைவு", submitted: "சமர்ப்பித்தது", under_review: "பரிசீலனையில்", need_documents: "ஆவணங்கள் தேவை", approved: "அங்கீகரிக்கப்பட்டது", rejected: "நிராகரிக்கப்பட்டது", refNo: "குறிப்பு எண்",
    welcome: "குரல் அல்லது எழுத்தில் கேளுங்கள். அதிகாரப்பூர்வ ஆதாரங்களுடன் திட்டங்களைக் கண்டுபிடிப்போம்.", errBusy: "சிறிது நேரம் கழித்து மீண்டும் முயலுங்கள்.", clear: "என் தரவை அழி",
  },
};

export function makeT(lang: string) {
  return (key: string): string => app[lang]?.[key] ?? app.en[key] ?? key;
}
/** Label from FormSaathi's locale namespaces, e.g. shared("ta","category","health"). */
export function shared_(lang: string, ns: string, key: string): string {
  return shared[lang]?.[ns]?.[key] ?? shared.en?.[ns]?.[key] ?? key.replace(/_/g, " ");
}
