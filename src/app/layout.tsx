import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ConfigProvider } from "@/lib/config";
import { ThemeColorInjector } from "@/components/ThemeColorInjector";
import { TextColorInjector } from "@/components/TextColorInjector";
import { UiStyleInjector } from "@/components/UiStyleInjector";
import { CustomCssInjector } from "@/components/CustomCssInjector";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { UpdateBanner } from "@/components/UpdateBanner";
import { SeoVerification } from "@/components/SeoVerification";
import { SiteCodeInjection } from "@/components/SiteCodeInjection";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  // Lets every page declare `alternates: { canonical: "/path" }` and have it
  // resolve to a full https://lotusplay.tech/... URL. Without this, a relative
  // canonical is dropped and Google is left to guess which URL is the original.
  metadataBase: new URL("https://lotusplay.tech"),
  alternates: { canonical: "/" },
  title: "LotusPlay Connect — Connect, Chat, Play & Grow Together",
  description:
    "LotusPlay Connect is a social voice-community and multiplayer gaming platform. Join voice rooms, make friends, play Ludo & Chess, and compete in tournaments.",
  applicationName: "LotusPlay Connect",
  // Stop Chrome/Google from auto-TRANSLATING the app: the translator mutates the
  // DOM out from under React, which caused "removeChild/insertBefore" crashes
  // (a blank "This page couldn't load") on the room page for non-English users.
  // The app has its own in-app text/label translation instead.
  // Also emit the Google AdSense ownership META tag — this renders a real
  // <meta name="google-adsense-account" content="ca-pub-…"> in the <head> of
  // every server-rendered page, which is exactly what AdSense's "Meta tag"
  // verification method looks for (deterministic, unlike a JS-loaded script).
  // NOTE: the google-adsense-account tag is NOT set here any more. It is
  // emitted by <SiteCodeInjection slot="head"> below, which reads the publisher
  // ID from the admin panel — so changing advertising account no longer needs a
  // code change. Setting it in both places would emit the tag twice.
  other: { google: "notranslate" },
  keywords: [
    "LotusPlay Connect",
    "voice chat rooms",
    "multiplayer ludo",
    "online chess",
    "social community",
    "tournaments",
  ],
  authors: [{ name: "LotusPlay Connect" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "LotusPlay Connect",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "LotusPlay Connect",
    description: "Connect, Chat, Play & Grow Together",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a18",
  width: "device-width",
  initialScale: 1,
  // THE ON-SCREEN KEYBOARD MUST SHRINK THE PAGE, NOT SLIDE OVER IT.
  // By default a phone keyboard covers the page instead of resizing it, so a
  // panel pinned to the bottom (the message box) ends up hidden behind the keys
  // — and the browser then scrolls the whole view up to reveal it, dragging the
  // seat strip off the top of the screen. "resizes-content" makes the visible
  // area shrink instead, so anything pinned to the top stays put and anything
  // pinned to the bottom sits directly above the keyboard.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      translate="no"
      className={`notranslate ${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* TEMPORARY diagnostic: capture any client-side error (chunk/script 404,
            JS exception, unhandled rejection) and beacon it to /api/client-log so
            we can see why a page fails to load in a real browser. Runs first. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var n=0;function s(o){if(n>200)return;n++;o.p=location.pathname;var j=JSON.stringify(o);try{if(navigator.sendBeacon){navigator.sendBeacon('/api/client-log',j);return}}catch(e){}try{fetch('/api/client-log',{method:'POST',body:j,keepalive:true})}catch(e){}}window.__lotusLog=s;" +
              "window.addEventListener('error',function(e){var t=e.target||e.srcElement;if(t&&t!==window&&(t.tagName==='SCRIPT'||t.tagName==='LINK'||t.tagName==='IMG')){s({k:'res',url:(t.src||t.href||'')})}else{s({k:'err',msg:e.message,src:e.filename,ln:e.lineno,st:(e.error&&e.error.stack)?String(e.error.stack).slice(0,800):''})}},true);" +
              "window.addEventListener('unhandledrejection',function(e){var r=e.reason;s({k:'rej',msg:(r&&r.message)?r.message:String(r),st:(r&&r.stack)?String(r.stack).slice(0,800):''})});" +
              "}catch(e){}})();",
          }}
        />
        {/* AdSense loader + the admin's own <head> code. Both come from
            Admin → Site Content → SEO, so the owner can change advertising
            account, add an analytics snippet or switch ads off entirely
            without a code change or a deploy. */}
        <SiteCodeInjection slot="head" />
        {/* Search Console / Bing ownership tags, if the admin has entered them. */}
        <SeoVerification />
        <ServiceWorkerRegister />
        <UpdateBanner />
        <AuthProvider>
          <ConfigProvider>
            <ThemeColorInjector />
            <UiStyleInjector />
            <CustomCssInjector />
            {/* Text Colours run AFTER the theme injectors on purpose — a theme
                change must never wash out the admin's chosen text colours. */}
            <TextColorInjector />
            <ToastProvider>{children}</ToastProvider>
          </ConfigProvider>
        </AuthProvider>
        {/* The admin's own end-of-body code (chat widgets, tracking pixels).
            Last thing in the document so a slow third-party script can never
            hold up the app itself. */}
        <SiteCodeInjection slot="footer" />
      </body>
    </html>
  );
}
