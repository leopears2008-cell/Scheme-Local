import { DEMO_ENABLED } from "../lib/demo";

/** Shown on every page while demo mode is on, so nobody mistakes sample data for real records. */
export default function DemoBanner() {
  if (!DEMO_ENABLED) return null;
  return <div className="demo-banner" role="status">DEMO MODE – sample data only. Not an official government service.</div>;
}
