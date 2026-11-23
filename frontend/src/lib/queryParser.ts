export type SchemeIntent = {
  query: string;
  state?: string;
  category?: string;
};

const STATE_ALIASES: Record<string, string> = {
  "tamil nadu": "Tamil Nadu", "tn": "Tamil Nadu", "தமிழ்நாடு": "Tamil Nadu",
  "andhra pradesh": "Andhra Pradesh", "ap": "Andhra Pradesh", "ஆந்திரா": "Andhra Pradesh",
  "karnataka": "Karnataka", "kerala": "Kerala", "telangana": "Telangana",
  "maharashtra": "Maharashtra", "rajasthan": "Rajasthan", "gujarat": "Gujarat",
  "uttar pradesh": "Uttar Pradesh", "bihar": "Bihar", "odisha": "Odisha",
  "west bengal": "West Bengal", "assam": "Assam", "punjab": "Punjab", "haryana": "Haryana",
};

// Kept separate from generic search ranking so state and category intent are explicit filters.
export function parseSchemeQuery(raw: string): SchemeIntent {
  const text = (raw || "").trim();
  const lower = text.toLowerCase();
  let state: string | undefined;

  for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
    if (lower === alias || lower.includes(` ${alias} `) || lower.startsWith(alias + " ") || lower.endsWith(" " + alias)) {
      state = canonical;
      break;
    }
  }

  let category: string | undefined;
  if (/\b(women|woman|female|girls?|mahil[aā]?|பெண்கள்?|மகளிர்)\b/i.test(text)) {
    category = "women";
  }

  return { query: text, state, category };
}
