import type { Scheme } from "./api";
import type { VerificationStatus } from "./contracts";

const AGRI_TERMS = new Set([
  "farmer", "farmers", "farming", "agriculture", "agricultural", "agri", "kisan", "krishi",
  "kisan-samman", "cultivator", "cultivators", "grower", "growers", "crop", "crops",
  "harvest", "uzhavar", "vivasaayam", "vivasayi", "விவசாயி", "விவசாயம்", "உழவர்",
  "fasal", "kheti"
]);

const SUBSIDY_TERMS = new Set([
  "subsidy", "subsidies", "subsidised", "subsidized", "subvention", "assistance", "grant"
]);

const IRRIGATION_TERMS = new Set([
  "irrigation", "drip", "sprinkler", "water", "pipeline", "borewell", "kudimaramathu", "pdmc"
]);

const FERTILIZER_TERMS = new Set([
  "fertilizer", "fertilizers", "biofertilizer", "bio-fertilizer", "rhizobium", "manure", "npv", "seed", "seeds"
]);

const INSURANCE_TERMS = new Set([
  "insurance", "bima", "fasal bima", "calamity", "relief", "pmfby"
]);

const STOPWORDS = new Set([
  "scheme", "schemes", "for", "in", "of", "the", "and", "to", "all", "yojana", "thittam",
  "a", "an", "is", "on", "with", "by", "திட்டம்", "திட்டங்கள்", "योजना"
]);

export function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/[^\w\s\u0900-\u097F\u0B80-\u0BFF]/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(text: string | null | undefined): string[] {
  const c = cleanText(text);
  return c ? c.split(" ") : [];
}

export interface SearchParams {
  q?: string;
  category?: string;
  state?: string;
  lang?: string;
  limit?: number | string;
  offset?: number | string;
}

export function filterAndRankSchemes(allSchemes: Scheme[], params: SearchParams): { total: number; items: Scheme[] } {
  const qRaw = (params.q || "").trim();
  const qClean = cleanText(qRaw);
  const qTokens = tokenize(qRaw);
  const contentTokens = qTokens.filter((t) => !STOPWORDS.has(t));

  const isAgri = qTokens.some((t) => AGRI_TERMS.has(t)) || qClean.includes("farmer") || qClean.includes("agriculture") || qClean.includes("kisan");
  const isSub = qTokens.some((t) => SUBSIDY_TERMS.has(t)) || qClean.includes("subsidy");
  const isIrrig = qTokens.some((t) => IRRIGATION_TERMS.has(t));
  const isFert = qTokens.some((t) => FERTILIZER_TERMS.has(t));
  const isIns = qTokens.some((t) => INSURANCE_TERMS.has(t));

  const targetCategory = (params.category || "").trim().toLowerCase();
  const targetState = (params.state || "").trim().toLowerCase();

  let candidates = allSchemes;

  // Category filter
  if (targetCategory) {
    candidates = candidates.filter((s) => (s.category || "").toLowerCase() === targetCategory);
  }

  // State filter
  if (targetState) {
    candidates = candidates.filter((s) => {
      const sState = (s.state || "").toLowerCase();
      const sLevel = (s.level || "").toLowerCase();
      if (targetState === "central") return sLevel === "central";
      return sState === targetState || (sLevel === "central" && (!sState || sState === targetState));
    });
  }

  // If no query string, return all matching candidates
  if (!qClean) {
    const limit = Math.max(1, parseInt(String(params.limit || "50"), 10) || 50);
    const offset = Math.max(0, parseInt(String(params.offset || "0"), 10) || 0);
    return {
      total: candidates.length,
      items: candidates.slice(offset, offset + limit)
    };
  }

  const scored: Array<{ scheme: Scheme; score: number }> = [];

  for (const s of candidates) {
    let score = 0;
    const name = s.name || "";
    const nameClean = cleanText(name);
    const nameTokens = new Set(tokenize(name));

    const cat = (s.category || "").toLowerCase();
    const dept = cleanText(s.department || "");
    const benefit = cleanText(s.benefit || "");
    const elig = cleanText((s.eligibility_rules || []).join(" "));
    const docs = cleanText((s.documents_required || []).join(" "));
    const how = cleanText(s.how_to_apply || "");

    const haystack = `${nameClean} ${cat} ${dept} ${benefit} ${elig} ${docs} ${how}`;

    // Exact query matches
    if (nameClean === qClean) {
      score += 100;
    } else if (nameClean.includes(qClean)) {
      score += 50;
    } else if (haystack.includes(qClean)) {
      score += 20;
    }

    // Token matches in name vs body
    for (const token of (contentTokens.length > 0 ? contentTokens : qTokens)) {
      if (nameTokens.has(token)) {
        score += 15;
      } else if (nameClean.includes(token)) {
        score += 8;
      } else if (haystack.includes(token)) {
        score += 3;
      }
    }

    // Intent boosts
    if (isAgri) {
      if (cat === "agriculture") score += 18;
      if (dept.includes("agriculture") || dept.includes("farmer")) score += 12;
      if (nameTokens.has("kisan") || nameClean.includes("kisan")) score += 15;
      if (nameTokens.has("farmer") || nameClean.includes("farmer")) score += 15;
      if (benefit.includes("farmer") || benefit.includes("agriculture") || benefit.includes("crop")) score += 8;
    }

    if (isSub) {
      if (nameClean.includes("subsidy") || haystack.includes("subsidy") || benefit.includes("subsidy")) score += 10;
    }

    if (isIrrig) {
      if (nameClean.includes("irrigation") || haystack.includes("irrigation") || haystack.includes("water") || haystack.includes("drip")) score += 15;
    }

    if (isFert) {
      if (nameClean.includes("fertilizer") || haystack.includes("fertilizer") || haystack.includes("manure")) score += 15;
    }

    if (isIns) {
      if (nameClean.includes("bima") || nameClean.includes("insurance") || haystack.includes("pmfby")) score += 20;
    }

    // Special exact IDs
    if ((qClean.includes("pm kisan") || qClean.includes("pmkisan")) && s.scheme_id === "pm_kisan") {
      score += 80;
    }

    if (score > 0) {
      scored.push({ scheme: s, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const limit = Math.max(1, parseInt(String(params.limit || "50"), 10) || 50);
  const offset = Math.max(0, parseInt(String(params.offset || "0"), 10) || 0);

  return {
    total: scored.length,
    items: scored.slice(offset, offset + limit).map((x) => x.scheme)
  };
}

export function computeSchemeMeta(allSchemes: Scheme[]): {
  total: number;
  categories: Record<string, number>;
  states: Record<string, number>;
  verification: Record<VerificationStatus, number>;
} {
  const categories: Record<string, number> = {};
  const states: Record<string, number> = {};
  const verification: Record<VerificationStatus, number> = {
    verified: 0,
    needs_review: 0,
    unverified: 0,
    expired: 0
  };

  for (const s of allSchemes) {
    const cat = s.category || "other";
    categories[cat] = (categories[cat] || 0) + 1;

    const st = s.state || (s.level === "central" ? "Central" : "Other");
    states[st] = (states[st] || 0) + 1;

    const v = (s.verification_status || s.verification || "unverified") as VerificationStatus;
    if (v in verification) {
      verification[v]++;
    } else {
      verification.unverified++;
    }
  }

  return {
    total: allSchemes.length,
    categories,
    states,
    verification
  };
}
