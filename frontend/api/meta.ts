import fs from "fs";
import path from "path";
import { computeSchemeMeta } from "../src/lib/schemeSearch";

let cachedSchemes: any[] | null = null;

function loadSchemes(): any[] {
  if (cachedSchemes) return cachedSchemes;
  try {
    const candidates = [
      path.join(process.cwd(), "frontend", "public", "schemes.json"),
      path.join(process.cwd(), "public", "schemes.json"),
      path.join(__dirname, "..", "public", "schemes.json"),
      path.join(__dirname, "public", "schemes.json"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        cachedSchemes = JSON.parse(fs.readFileSync(p, "utf-8"));
        return cachedSchemes || [];
      }
    }
  } catch (err) {
    console.error("Failed to load schemes in meta function:", err);
  }
  return [];
}

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const schemes = loadSchemes();
  const meta = computeSchemeMeta(schemes);
  return res.status(200).json(meta);
}
