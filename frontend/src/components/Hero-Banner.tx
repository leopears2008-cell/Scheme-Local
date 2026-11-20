"use client";
import React from "react";

interface HeroBannerProps {
  isListening: boolean;
  onMicClick: () => void;
  onSearch: (query: string) => void;
}

export function HeroBanner({ isListening, onMicClick, onSearch }: HeroBannerProps) {
  const [query, setQuery] = React.useState("");

  return (
    <section className="sahayak-hero-bg w-full px-6 py-10 md:py-14">
      <div className="relative z-10 mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-12 items-center gap-6">
        <div className="md:col-span-7 flex flex-col items-center md:items-start text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#102a71] leading-tight">
            உங்கள் தகுதியை நொடியில் கண்டறியுங்கள்!
          </h1>
          <p className="mt-2 text-lg font-semibold text-[#1e3a8a]">
            Discover your eligibility in seconds!
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-5 w-full">
            <button
              type="button"
              onClick={onMicClick}
              aria-label="Speak to search schemes"
              className={`sahayak-mic-glow ${isListening ? "is-listening" : ""} h-28 w-28 shrink-0 rounded-full text-white flex flex-col items-center justify-center px-3 cursor-pointer`}
            >
              <span className="text-3xl">🎙️</span>
              <span className="mt-1 text-xs font-bold leading-tight text-center">
                {isListening ? "கேட்கிறது..." : "பேச இங்கே அழுத்தவும்"}
              </span>
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) onSearch(query.trim());
              }}
              className="flex w-full max-w-md items-center rounded-full bg-white p-1.5 pl-4 shadow-lg border border-slate-200/80"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="அல்லது உங்கள் கேள்வியை தட்டச்சு செய்யவும்..."
                className="w-full bg-transparent text-sm text-slate-800 outline-none"
              />
              <button
                type="submit"
                className="h-9 w-9 shrink-0 rounded-full bg-[#f97316] text-white font-bold hover:bg-[#ea580c] cursor-pointer"
              >
                →
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
