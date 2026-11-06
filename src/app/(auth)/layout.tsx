import { LotusMark } from "@/components/Logo";
import { BrandImg } from "@/components/BrandImg";
import { RedirectIfAuthed } from "@/components/RedirectIfAuthed";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* A signed-in user who navigates back to login/signup is sent to /home. */}
      <RedirectIfAuthed />
      {/* Ambient background — glossy 3D game objects floating around the card */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Left side */}
        <BrandImg slot="objDice" className="absolute left-[6%] top-[8%] hidden w-24 rotate-6 animate-float drop-shadow-2xl sm:block" />
        <BrandImg slot="objController" className="absolute left-[11%] top-[36%] hidden w-20 -rotate-6 animate-float-slow drop-shadow-2xl lg:block" />
        <BrandImg slot="objCoin" className="absolute bottom-[13%] left-[10%] hidden w-20 rotate-3 animate-float drop-shadow-2xl sm:block" />
        {/* Right side */}
        <BrandImg slot="objGem" className="absolute right-[8%] top-[26%] hidden w-20 -rotate-6 animate-float-slow drop-shadow-2xl sm:block" />
        <BrandImg slot="objCoin" className="absolute right-[6%] top-[54%] hidden w-16 rotate-6 animate-float drop-shadow-2xl lg:block" />
        <BrandImg slot="objDice" className="absolute bottom-[10%] right-[10%] hidden w-20 -rotate-3 animate-float-slow drop-shadow-2xl sm:block" />
      </div>

      <div className="w-full max-w-md">
        {/* Stacked brand mark */}
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="relative grid place-items-center">
            <LotusMark className="size-16" />
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight">
            <span className="text-gradient">Lotus</span>{" "}
            <span className="text-mist-200">Connect</span>
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.25em] text-mist-500">
            Connect · Chat · Play · Win
          </p>
        </div>

        {/* Centered card — near-solid for crisp, high-contrast text */}
        <div className="rounded-2xl border border-white/12 bg-ink-850/95 p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8">
          {children}
        </div>

        <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-mist-500">
          <a href="/about" className="hover:text-mist-300">About</a>
          <span>·</span>
          <a href="/blog" className="hover:text-mist-300">Blog</a>
          <span>·</span>
          <a href="/faq" className="hover:text-mist-300">FAQ</a>
          <span>·</span>
          <a href="/legal/terms" className="hover:text-mist-300">Terms</a>
          <span>·</span>
          <a href="/legal/privacy" className="hover:text-mist-300">Privacy</a>
          <span>·</span>
          <a href="/disclaimer" className="hover:text-mist-300">Disclaimer</a>
          <span>·</span>
          <a href="/legal/refund" className="hover:text-mist-300">Refund</a>
          <span>·</span>
          <a href="/legal/community" className="hover:text-mist-300">Community</a>
          <span>·</span>
          <a href="/legal/contact" className="hover:text-mist-300">Contact</a>
        </nav>
        <p className="mt-2 text-center text-xs text-mist-500">
          © {new Date().getFullYear()} LotusPlay Connect. All rights reserved.
        </p>
      </div>
    </div>
  );
}
