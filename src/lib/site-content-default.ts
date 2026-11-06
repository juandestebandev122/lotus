// Default public-site content (About, FAQ, Disclaimer, Blog). All of this is
// editable from Admin → Site Content, so pages/blogs/FAQ/SEO never need a code
// change (AdSense requirement). Bodies are simple HTML (h2/p/ul/li/strong).

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;        // simple HTML
  cover?: string;      // cover image URL
  author?: string;
  date: string;        // ISO
  published: boolean;
  seoTitle?: string;
  seoDesc?: string;
}
export interface SitePage { title: string; body: string; seoTitle?: string; seoDesc?: string; published?: boolean }
export interface FaqBlock { title?: string; seoTitle?: string; seoDesc?: string; items: { q: string; a: string }[] }

/**
 * The real-world contact details shown on /legal/contact and referenced by the
 * Privacy Policy. These MUST be genuine — an ad network or app store reviewing
 * the site will check them, and the IT Rules 2021 require a named grievance
 * officer with a working address. Everything here is editable at
 * Admin → Site Content → Contact, so no code change is needed to correct them.
 */
export interface ContactInfo {
  brandName?: string;       // the trading name shown to users
  legalName?: string;       // the registered company/proprietor name, if different
  address?: string;         // registered business address (blank = not shown)
  supportEmail?: string;
  privacyEmail?: string;    // where data/deletion requests go
  grievanceName?: string;   // named grievance officer (IT Rules 2021)
  grievanceEmail?: string;
  phone?: string;
  hours?: string;           // e.g. "Sunday–Thursday, 9am–6pm (AST)"
  ackHours?: number;        // we acknowledge within N hours
  resolveDays?: number;     // we aim to resolve within N days
}

/**
 * EVERY BLOCK OF WORDS ON THE PUBLIC HOME PAGE.
 *
 * Only the homepage intro near the bottom used to be editable — the headline,
 * the four statistics, and all the cards down the page were written into the
 * code, so changing a single word meant a developer and a deploy.
 *
 * Everything here is TEXT. The icons, the colours, the animated dice and the
 * layout stay in code: they are design, not content, and exposing them would
 * make it easy to break the page from a text box. A card's icon is paired with
 * it by position, so reordering or adding cards keeps sensible icons.
 *
 * Every field falls back to the built-in wording, so an untouched install and a
 * half-filled form both render exactly as before.
 */
export interface HomeCard { title?: string; text?: string }
export interface HomeStat { value?: string; label?: string }
export interface HomeStep { num?: string; title?: string; text?: string }

export interface HomePageContent {
  hero?: {
    badge?: string;
    /** The headline is three coloured parts: gradient, white, gold. */
    titleA?: string; titleB?: string; titleC?: string;
    subtitle?: string;
    primaryLabel?: string; primaryHref?: string;
    secondaryLabel?: string; secondaryHref?: string;
    installLabel?: string;
    stats?: HomeStat[];
  };
  pillars?: { eyebrow?: string; title?: string; subtitle?: string; cards?: HomeCard[] };
  games?: { badge?: string; titleA?: string; titleB?: string; text?: string; bullets?: string[]; buttonLabel?: string; buttonHref?: string };
  features?: { eyebrow?: string; title?: string; subtitle?: string; cards?: HomeCard[] };
  journey?: { eyebrow?: string; title?: string; steps?: HomeStep[] };
  cta?: { title?: string; text?: string; buttonLabel?: string; buttonHref?: string };
}

export const DEFAULT_HOME_PAGE: Required<HomePageContent> = {
  hero: {
    badge: "The social voice-gaming platform",
    titleA: "Connect, Chat,",
    titleB: "Play & Grow",
    titleC: "Together",
    subtitle: "LotusPlay Connect brings live voice rooms, multiplayer Ludo & Chess, tournaments and communities into one beautiful app. Make friends, host rooms, and compete — all in real time.",
    primaryLabel: "Join LotusPlay Connect", primaryHref: "/login",
    secondaryLabel: "Explore games", secondaryHref: "#games",
    installLabel: "Install Now",
    stats: [
      { value: "12K+", label: "Players" },
      { value: "250+", label: "Live rooms" },
      { value: "9K+", label: "Games played" },
      { value: "4.9", label: "App rating" },
    ],
  },
  pillars: {
    eyebrow: "One platform",
    title: "Everything you love, in one place",
    subtitle: "Voice, games, tournaments and communities — designed to keep your people together.",
    cards: [
      { title: "Live Voice Rooms", text: "Host or join public, private & password-protected rooms. Talk in real time with crystal-clear voice." },
      { title: "Multiplayer Games", text: "Play Ludo (2–4 players) and Chess with friends — right inside your voice room." },
      { title: "Tournaments", text: "Knockout & league formats, live brackets, leaderboards and winner announcements." },
      { title: "Communities", text: "Build interest-based communities with feeds, chat, announcements and dedicated rooms." },
    ],
  },
  games: {
    badge: "Play with voice",
    titleA: "Ludo & Chess,",
    titleB: "better with friends",
    text: "Challenge friends or get matched with players worldwide. Talk live while you play, watch as a spectator, and track every win on your profile.",
    bullets: [
      "Multiplayer Ludo — 2 to 4 players",
      "Classic Chess — Rapid, Blitz & Classical",
      "Voice chat during every match",
      "Match history, stats & rankings",
    ],
    buttonLabel: "Start playing", buttonHref: "/login",
  },
  features: {
    eyebrow: "Built for connection",
    title: "Powerful features, beautifully simple",
    subtitle: "Everything a modern social community needs — thoughtfully crafted.",
    cards: [
      { title: "Private & Group Chat", text: "1:1 and group messaging with media, voice notes, reactions and read receipts." },
      { title: "Friends & Follow", text: "Send requests, follow creators, and grow your circle across the platform." },
      { title: "Smart Notifications", text: "Stay updated on invites, requests, tournaments and rewards in real time." },
      { title: "Safe & Moderated", text: "OTP verification, blocking, reporting and powerful host/moderator controls." },
      { title: "Voice During Gameplay", text: "Trash-talk, strategize and laugh together while you play — all in voice." },
      { title: "Rankings & Rewards", text: "Climb leaderboards, earn coins, unlock badges and show off your status." },
    ],
  },
  journey: {
    eyebrow: "Get started in minutes",
    title: "Your journey on LotusPlay Connect",
    steps: [
      { num: "01", title: "Sign up", text: "Join with your mobile number or email in seconds." },
      { num: "02", title: "Build your circle", text: "Add friends, follow creators, join communities." },
      { num: "03", title: "Hop in a room", text: "Host or join live voice rooms and start talking." },
      { num: "04", title: "Play & compete", text: "Battle in Ludo & Chess, win tournaments, climb the ranks." },
    ],
  },
  cta: {
    title: "Ready to join the community?",
    text: "Thousands of players are connecting, chatting and competing right now. Your seat at the table is waiting.",
    buttonLabel: "Create free account", buttonHref: "/login",
  },
};

/**
 * Admin text over the built-in wording, FIELD BY FIELD.
 *
 * A blank box falls back to the original rather than emptying a heading, and a
 * deleted list falls back to the original list — so a half-filled form still
 * renders a complete page instead of a page with holes in it.
 */
export function resolveHomePage(v?: HomePageContent): Required<HomePageContent> {
  const d = DEFAULT_HOME_PAGE;
  /** Merge one section: keep every default, let non-blank admin text win. */
  const merge = <T extends object>(base: T, over?: Partial<T>): T => {
    const out = { ...base };
    for (const [k, val] of Object.entries(over ?? {})) {
      if (val === undefined || val === null) continue;
      if (typeof val === "string" && !val.trim()) continue;      // blank → keep default
      if (Array.isArray(val) && val.length === 0) continue;       // emptied → keep default
      (out as Record<string, unknown>)[k] = val;
    }
    return out;
  };
  return {
    hero: merge(d.hero, v?.hero),
    pillars: merge(d.pillars, v?.pillars),
    games: merge(d.games, v?.games),
    features: merge(d.features, v?.features),
    journey: merge(d.journey, v?.journey),
    cta: merge(d.cta, v?.cta),
  };
}

export interface SiteContent {
  homePage?: HomePageContent;
  seo?: {
    siteTitle?: string; description?: string; keywords?: string;
    // The content of Google's <meta name="google-site-verification"> tag — the
    // simplest way to prove ownership in Search Console without FTP access.
    googleVerification?: string;
    // Same idea for Bing Webmaster Tools.
    bingVerification?: string;
  };
  /**
   * CODE THE ADMIN CAN PUT ON THE SITE WITHOUT A DEVELOPER.
   *
   * The AdSense publisher ID used to be hard-coded in the root layout, which
   * meant changing advertising account — or turning ads off — needed a code
   * change and a deploy. These three fields move that control into the admin
   * panel, where the owner can manage it themselves.
   *
   * `headCode` and `footerCode` are inserted into the page EXACTLY as written.
   * That is the point of them (analytics snippets, ad tags, verification
   * scripts all need to be verbatim) and also their risk: bad HTML here can
   * break every page on the site. Admin-only, and the admin panel warns about
   * it clearly.
   */
  customCode?: {
    /** AdSense publisher ID, e.g. "ca-pub-1234567890123456". Empty = no ads. */
    adsenseClient?: string;
    /** Raw HTML/JS injected into every page's <head>. */
    headCode?: string;
    /** Raw HTML/JS injected at the end of every page's <body>. */
    footerCode?: string;
  };
  homeIntro?: string;   // extra homepage text (helps reach the word count)
  /**
   * Pictures and MP4 videos shown on the user home page.
   * Admin → Site Content → SEO & Home keeps the list. Every saved item is
   * shown, in order. `image` + `kind` mirror the first item so an older
   * single-picture save still appears when the list is empty.
   */
  homeFeature?: {
    image?: string;     // URL of the SELECTED item (never a giant data URL)
    kind?: "image" | "video";
    alt?: string;       // what the picture says, for screen readers and search
    caption?: string;   // optional line under the picture
    href?: string;      // optional internal link the picture opens
    selectedId?: string;
    items?: HomeFeatureItem[];
  };
  about?: SitePage;
  disclaimer?: SitePage;
  faq?: FaqBlock;
  contact?: ContactInfo;
  blog?: BlogArticle[];
}

export interface HomeFeatureItem {
  id: string;
  url: string;
  kind: "image" | "video";
  name?: string;
}

/** Every picture and MP4 saved for the home page, in upload order. A page
 *  saved before the list existed still contributes its single picture. */
export function listHomeFeature(f?: SiteContent["homeFeature"]): HomeFeatureItem[] {
  const items = (f?.items ?? []).filter((i) => i.url);
  if (items.length) return items;
  if (f?.image) return [{ id: "current", url: f.image, kind: f.kind === "video" ? "video" : "image", name: "Current" }];
  return [];
}

const P = (s: string) => s.trim();

export const DEFAULT_SITE_CONTENT: SiteContent = {
  seo: {
    siteTitle: "Lotus Ludo — Play Ludo, Voice Rooms, Tournaments & More",
    description: "Lotus Ludo is a social gaming platform to play Ludo online, join live voice rooms, enter tournaments, and connect with friends. Play free, fair and safe.",
    keywords: "ludo online, play ludo, voice chat rooms, ludo tournament, social gaming, lotus ludo",
  },
  homeIntro: P(`
<h2>Welcome to Lotus Ludo</h2>
<p>Lotus Ludo is a modern social gaming platform that brings the classic game of Ludo together with live voice rooms, tournaments, gifting and a friendly community. Whether you want a quick match with friends, a competitive knockout tournament, or just a place to hang out and chat, Lotus Ludo is built to be fun, fair and safe for everyone.</p>
<p>Our mission is to make online play feel personal again. Real-time voice rooms let you talk while you play, animated boards make every match feel premium, and a level and rewards system keeps the experience rewarding. Everything runs in your browser — no heavy download required — and installs as an app on your phone in one tap.</p>
<h2>What you can do on Lotus Ludo</h2>
<ul>
<li><strong>Play Ludo online</strong> with friends or other players, on a beautiful animated board.</li>
<li><strong>Join live voice rooms</strong> to talk, host and meet new people in real time.</li>
<li><strong>Enter tournaments</strong> with automatic brackets, match rooms and prizes.</li>
<li><strong>Send gifts</strong> and climb the level and rewards system.</li>
<li><strong>Stay safe</strong> with moderation tools, reporting and clear community guidelines.</li>
</ul>
<p>Lotus Ludo is designed for players aged 18 and above. We take responsible play, privacy and safety seriously — read our policies any time from the footer of every page.</p>
`),
  about: {
    published: true,
    title: "About Lotus Ludo",
    seoTitle: "About Us — Lotus Ludo",
    seoDesc: "Learn about Lotus Ludo, a social gaming platform for Ludo, live voice rooms, tournaments and a safe, friendly community.",
    body: P(`
<h1>About Lotus Ludo</h1>
<p>Lotus Ludo is a social gaming platform where people come together to play the timeless game of Ludo, talk in live voice rooms, compete in tournaments and make new friends. We built Lotus Ludo because we believe online games are best when they are social — when you can hear a friend laugh after a lucky roll, celebrate a win together, or meet someone new in a friendly room.</p>
<h2>Our story</h2>
<p>Ludo has been played across the world for generations. We wanted to bring that same warmth to the internet, with modern touches: real-time voice, polished animations, tournaments that run themselves, and a rewards system that makes every session feel worthwhile. Lotus Ludo grew from that simple idea into a full social-gaming home.</p>
<h2>What we stand for</h2>
<ul>
<li><strong>Fair play.</strong> Games are designed to be fair, and we act on cheating and abuse.</li>
<li><strong>Safety first.</strong> Moderation, reporting and clear guidelines keep the community healthy.</li>
<li><strong>Respect &amp; privacy.</strong> We handle your information responsibly — see our Privacy Policy.</li>
<li><strong>Responsible play.</strong> Lotus Ludo is entertainment, meant for players 18 and over.</li>
</ul>
<h2>Contact us</h2>
<p>Have a question, suggestion, or need help? We would love to hear from you. Visit our <a href="/legal/contact">Contact page</a> and we will get back to you.</p>
`),
  },
  disclaimer: {
    published: true,
    title: "Disclaimer",
    seoTitle: "Disclaimer — Lotus Ludo",
    seoDesc: "Read the Lotus Ludo disclaimer covering entertainment use, virtual coins, third-party links and responsible play.",
    body: P(`
<h1>Disclaimer</h1>
<p>The information and services provided on Lotus Ludo (the &ldquo;Platform&rdquo;) are for general entertainment purposes only. By using the Platform you accept this disclaimer in full.</p>
<h2>Entertainment only</h2>
<p>Lotus Ludo is a social entertainment platform. Games such as Ludo are provided for fun. Any virtual &ldquo;coins&rdquo; or in-app items have no real-world monetary value outside the Platform and are not a substitute for money or legal tender.</p>
<h2>No professional advice</h2>
<p>Nothing on the Platform — including blog articles and help content — constitutes professional, financial, legal or gambling advice. Always use your own judgement and, where appropriate, seek qualified advice.</p>
<h2>Third-party links &amp; content</h2>
<p>The Platform may contain links to third-party websites or display advertisements served by third parties. We are not responsible for the content, policies or practices of any third-party site or advertiser.</p>
<h2>Responsible play</h2>
<p>Lotus Ludo is intended for adults aged 18 and above. Please play responsibly and take regular breaks. If gaming stops being fun, step away.</p>
<h2>Accuracy</h2>
<p>We work to keep information on the Platform accurate and up to date, but we make no warranties about completeness or reliability. Use of the Platform is at your own risk.</p>
`),
  },
  contact: {
    brandName: "Lotus Ludo",
    legalName: "",
    address: "",
    supportEmail: "support@lotusplay.tech",
    privacyEmail: "privacy@lotusplay.tech",
    grievanceName: "",
    grievanceEmail: "grievance@lotusplay.tech",
    phone: "",
    hours: "",
    ackHours: 24,
    resolveDays: 15,
  },
  faq: {
    title: "Frequently Asked Questions",
    seoTitle: "FAQ — Lotus Ludo",
    seoDesc: "Answers to common questions about playing Ludo, voice rooms, tournaments, coins, safety and accounts on Lotus Ludo.",
    items: [
      { q: "What is Lotus Ludo?", a: "Lotus Ludo is a social gaming platform where you can play Ludo online, join live voice rooms, enter tournaments, send gifts and connect with a friendly community — all from your browser or phone." },
      { q: "Is Lotus Ludo free to play?", a: "Yes. You can create an account and play Ludo and join rooms for free. Some optional features use virtual coins, which you can buy if you choose to." },
      { q: "How do I play Ludo on Lotus Ludo?", a: "Open the Games section, choose Ludo, and start or join a match. On your turn, tap the dice to roll, then tap a token to move it. First to get all tokens home wins." },
      { q: "What are voice rooms?", a: "Voice rooms are live audio rooms where you can talk, host, listen and meet people in real time. You can play games together while chatting." },
      { q: "How do tournaments work?", a: "Register for a tournament, get approved by the host, and you are placed into match rooms. Winners advance automatically round by round until a champion is crowned, and prizes are distributed to the top places." },
      { q: "What are coins used for?", a: "Coins are virtual items used for gifts and some premium features. They have no real-world value outside the platform. See our Refund Policy for purchase details." },
      { q: "Is Lotus Ludo safe?", a: "We take safety seriously. We have moderation tools, in-app reporting, and clear Community Guidelines. Please report anyone who breaks the rules and we will act on it." },
      { q: "What age do I need to be?", a: "Lotus Ludo is intended for players aged 18 and above. Please play responsibly." },
      { q: "How do I install the app?", a: "Lotus Ludo runs in your browser and installs as an app in one tap. On your phone, open the site and choose &lsquo;Add to Home screen&rsquo; (or use the install button when shown)." },
      { q: "How do I contact support?", a: "Visit our Contact page from the footer, or use the in-app Support section, and our team will help you." },
    ],
  },
  blog: [
    {
      id: "b_how-to-play-ludo", slug: "how-to-play-ludo", published: true, author: "Lotus Ludo Team", date: "2026-07-01T00:00:00.000Z",
      title: "How to Play Ludo: A Complete Beginner's Guide",
      excerpt: "New to Ludo? Learn the rules, the board, and simple strategies to start winning your first games on Lotus Ludo.",
      seoTitle: "How to Play Ludo — Rules & Beginner Guide | Lotus Ludo",
      seoDesc: "A complete beginner's guide to Ludo: the board, the rules, how tokens move, safe squares, and easy strategies to win.",
      body: P(`
<p>Ludo is one of the most loved board games in the world — easy to learn, hard to master, and endlessly fun with friends. This guide walks you through everything a beginner needs to start playing on Lotus Ludo.</p>
<h2>The goal of the game</h2>
<p>Each player has four tokens that begin in their home yard. The goal is simple: move all four of your tokens around the board and into the centre home before your opponents do. The first player to get all four tokens home wins.</p>
<h2>The board</h2>
<p>The Ludo board has four coloured corners — red, green, blue and yellow — and a cross-shaped track that leads to the centre. Each colour has its own starting square and a coloured path leading into the middle. Star squares along the track are &ldquo;safe&rdquo; squares where your token cannot be captured.</p>
<h2>How a turn works</h2>
<ul>
<li>On your turn, tap the dice to roll a number from 1 to 6.</li>
<li>You need a 6 to move a token out of your home yard onto the board.</li>
<li>Tap a token to move it forward by the number you rolled.</li>
<li>Rolling a 6 gives you another turn.</li>
<li>If your token lands on an opponent's token (not on a safe square), you capture it and send it back to their yard.</li>
</ul>
<h2>Simple strategies to win</h2>
<ul>
<li><strong>Spread your tokens.</strong> Don't push a single token; move several so you always have options.</li>
<li><strong>Use safe squares.</strong> Park on star squares when opponents are close.</li>
<li><strong>Capture when it counts.</strong> Sending an opponent home can swing the game.</li>
<li><strong>Count to home.</strong> Near the end, plan rolls so tokens land exactly on the final square.</li>
</ul>
<p>Ready to play? Jump into a match on Lotus Ludo, invite a friend into a voice room, and enjoy the game the way it's meant to be — together.</p>
`),
    },
    {
      id: "b_ludo-strategy-tips", slug: "ludo-strategy-tips", published: true, author: "Lotus Ludo Team", date: "2026-07-03T00:00:00.000Z",
      title: "7 Ludo Strategy Tips to Win More Games",
      excerpt: "Move from beginner to winner with these seven practical Ludo strategies used by experienced players.",
      seoTitle: "7 Ludo Strategy Tips to Win More Games | Lotus Ludo",
      seoDesc: "Practical Ludo strategy: token spreading, safe squares, capturing, risk management and endgame tips to win more matches.",
      body: P(`
<p>Ludo has more strategy than it first appears. A little planning goes a long way. Here are seven tips that will help you win more games on Lotus Ludo.</p>
<h2>1. Open multiple tokens early</h2>
<p>Every 6 is a chance to bring a token onto the board. The more tokens you have in play, the more flexible your moves become.</p>
<h2>2. Keep tokens on safe squares</h2>
<p>Star squares protect you from capture. When an opponent's token is within six squares, aim to end your move on a safe square.</p>
<h2>3. Hunt captures — but wisely</h2>
<p>Capturing an opponent sends them all the way home, a huge tempo swing. Look for capture chances, but don't expose your own token to a bigger risk.</p>
<h2>4. Manage risk near your yard exit</h2>
<p>Opponents often camp near your starting square. Don't stack all your tokens at the exit where a single capture could hurt.</p>
<h2>5. Block with pairs</h2>
<p>Two tokens of the same colour on one square can form a strong position. Use it to control key parts of the track.</p>
<h2>6. Think about the whole board</h2>
<p>Watch all four colours, not just your own. Anticipate where opponents will move and plan around them.</p>
<h2>7. Nail the endgame</h2>
<p>To finish, a token must land exactly on the final home square. Count carefully and hold tokens back if you need a specific roll.</p>
<p>Practice these on Lotus Ludo and you'll see your win rate climb. Good luck — and have fun.</p>
`),
    },
    {
      id: "b_voice-rooms-guide", slug: "voice-rooms-guide", published: true, author: "Lotus Ludo Team", date: "2026-07-05T00:00:00.000Z",
      title: "Getting Started with Voice Rooms on Lotus Ludo",
      excerpt: "Voice rooms make Lotus Ludo social. Here's how to join, host and enjoy live audio rooms safely.",
      seoTitle: "Voice Rooms Guide — Host & Join Live Audio | Lotus Ludo",
      seoDesc: "How to join and host live voice rooms on Lotus Ludo, use the mic, invite friends, play games together and stay safe.",
      body: P(`
<p>One of the things that makes Lotus Ludo special is live voice rooms — real-time audio spaces where you can talk, host and meet people while you play. Here's how to get the most out of them.</p>
<h2>Joining a room</h2>
<p>Open the Voice Rooms section and tap any public room to enter. Allow microphone access when asked, then unmute to speak. Prefer to listen first? Stay muted and enjoy the conversation.</p>
<h2>Hosting your own room</h2>
<p>Create a room to become the host. Hosts can manage seats, invite friends, mute disruptive members and keep the room friendly. You can even play Ludo with your room while chatting.</p>
<h2>Playing games together</h2>
<p>Games and voice work side by side, so you can talk while you roll the dice. It turns a quiet match into a lively, social experience.</p>
<h2>Staying safe</h2>
<ul>
<li>Report anyone who breaks the rules — hosts and admins can act quickly.</li>
<li>Read our Community Guidelines so everyone knows what's expected.</li>
<li>Use headphones to avoid echo and get the best audio quality.</li>
</ul>
<p>Voice rooms are where friendships form on Lotus Ludo. Jump in, say hello, and enjoy.</p>
`),
    },
    {
      id: "b_tournaments-explained", slug: "tournaments-explained", published: true, author: "Lotus Ludo Team", date: "2026-07-07T00:00:00.000Z",
      title: "Lotus Ludo Tournaments Explained",
      excerpt: "From registration to champion: how tournaments, match rooms and prizes work on Lotus Ludo.",
      seoTitle: "Tournaments Explained — Brackets, Rooms & Prizes | Lotus Ludo",
      seoDesc: "Understand Lotus Ludo tournaments: registration, approval, match rooms, qualification, automatic rounds and prize distribution.",
      body: P(`
<p>Tournaments turn Lotus Ludo into a competition. Here's how they work, from the moment you register to the moment a champion is crowned.</p>
<h2>1. Register</h2>
<p>Find an upcoming tournament and request to join. The host reviews requests and approves players. Only approved players take part.</p>
<h2>2. Match rooms</h2>
<p>When the tournament starts, the system automatically creates match rooms and assigns players. Depending on the format, rooms hold 2 or 4 players and require a set number of winners to qualify.</p>
<h2>3. Qualification &amp; rounds</h2>
<p>A room stays open until the required number of players qualify; the rest are eliminated. The next round is generated automatically from the qualified players, and this continues through the bracket.</p>
<h2>4. Champion &amp; prizes</h2>
<p>When one player remains, they're the champion. Prizes are awarded to the top places — typically 1st, 2nd, 3rd and 4th — and credited to the winners' wallets.</p>
<p>Tournaments are a great way to test your skills and win rewards. Watch the tournaments section for the next event.</p>
`),
    },
    {
      id: "b_responsible-play", slug: "responsible-gaming", published: true, author: "Lotus Ludo Team", date: "2026-07-09T00:00:00.000Z",
      title: "Playing Responsibly on Lotus Ludo",
      excerpt: "Games should always be fun. Here are simple habits for healthy, responsible play.",
      seoTitle: "Responsible Gaming — Healthy Play Tips | Lotus Ludo",
      seoDesc: "Responsible gaming on Lotus Ludo: set limits, take breaks, keep it social and know when to step away. Play for fun.",
      body: P(`
<p>At Lotus Ludo, we want playing to stay fun. Responsible play means enjoying the game while keeping it a positive part of your day. Here are a few simple habits.</p>
<h2>Set your own limits</h2>
<p>Decide how much time you want to spend before you start, and stick to it. Games are more enjoyable when they fit around the rest of your life, not the other way around.</p>
<h2>Take regular breaks</h2>
<p>Stand up, stretch and rest your eyes between sessions. Short breaks keep you sharp and make the game more enjoyable.</p>
<h2>Keep it social and kind</h2>
<p>The best part of Lotus Ludo is the people. Be respectful in voice rooms and chat, celebrate good play, and help newcomers feel welcome.</p>
<h2>Know when to step away</h2>
<p>If a session stops being fun, it's okay to log off and come back later. The game will always be here when you're ready.</p>
<h2>We're here to help</h2>
<p>If you ever have concerns about your play or someone else's, reach out through our Contact page. Play well, play kind, and enjoy the game.</p>
`),
    },
    {
      id: "b_how-to-win-ludo", slug: "how-to-win-ludo", published: true, author: "Lotus Ludo Team", date: "2026-07-12T00:00:00.000Z",
      title: "How to Win at Ludo: The Decisions That Actually Decide Games",
      excerpt: "Ludo looks like luck, but most games are decided by a handful of choices. Here is how strong players think about each one.",
      seoTitle: "How to Win at Ludo — Decision-Making Guide | Lotus Ludo",
      seoDesc: "Learn how to win at Ludo: which token to move, when to leave a safe square, how to weigh a capture, and how to close out the endgame.",
      body: P(`
<p>Ask most people what decides a game of Ludo and they will say the dice. It is easy to see why — you cannot choose your roll. But the dice only give you a number. What you do with that number is entirely yours, and over a full game those choices add up to far more than luck does.</p>
<p>Here is the honest way to think about it. In a typical game you will roll around forty times. On perhaps thirty of those rolls you will have more than one legal move. That is thirty decisions per game. A player who chooses well on most of them will beat a player who chooses badly, even with worse dice, most of the time.</p>
<h2>Decision one: which token to move</h2>
<p>This is the choice you face most often, and the one most beginners rush. Before you tap, ask three quick questions:</p>
<ul>
<li><strong>Does this move capture anything?</strong> A capture sends an opponent's token all the way back to their yard, undoing every roll they spent on it. Nothing else in Ludo swings a game so hard.</li>
<li><strong>Does this move land me somewhere safe?</strong> Finishing your move on a star square means you cannot be captured before your next turn.</li>
<li><strong>Does this move leave something exposed?</strong> Moving one token forward often leaves another sitting in range of an opponent. Look at the board, not just the token you were about to move.</li>
</ul>
<p>If a move ticks two of those boxes, it is usually right. If it ticks none, look for a different token.</p>
<h2>Decision two: when to bring a new token out</h2>
<p>Every 6 gives you the option to open a token from your yard. New players almost always open too few; they push one token hard and end up with no choices when the dice go against them.</p>
<p>The general rule is to get two or three tokens onto the board early. With one token in play you are at the mercy of the roll. With three, almost every number gives you something useful, and that flexibility is what lets you take captures and dodge danger when it matters.</p>
<p>The exception is late in the game. Once you have tokens close to home, opening a fresh token from the yard is a long journey that may never pay off. At that stage, prefer moves that finish what you have started.</p>
<h2>Decision three: how much risk to accept</h2>
<p>Risk in Ludo is measurable. A token is in danger if an opponent's token sits between one and six squares behind it — those are the numbers they can roll. Six squares behind is one number of danger; one square behind is also one number. A token sitting three squares ahead of two different opponents is in genuine trouble.</p>
<p>So before you leave a safe square, count. If moving forward puts you within six of two opponents, and staying put costs you very little, staying put is often correct. Patience is a real strategy in Ludo, not a lack of one.</p>
<h2>Decision four: whether to take the capture</h2>
<p>Captures are exciting, and usually right — but not always. Taking a capture that lands your token deep in an opponent's territory, exposed to two other colours, can cost you more than it gains. Ask what the board looks like <em>after</em> the capture, not just during it.</p>
<p>A good rule: take the capture if it is on or near a safe square, or if it sends home a token that was close to finishing. Think twice if it strands you in the open in front of the player whose token you just sent back — they now have every reason to come after you.</p>
<h2>Decision five: the endgame</h2>
<p>The final stretch is where games are quietly lost. To finish, a token must land <em>exactly</em> on the last square. Roll too high and the move is wasted.</p>
<p>Plan backwards. If a token needs a 3 to finish, do not shuffle it forward with a 2 and leave it needing a 1. Move a different token instead and keep the exact number you need. Strong players often hold two tokens at different distances precisely so that most rolls are useful to one of them.</p>
<h2>Putting it together</h2>
<p>You will still lose games to a run of sixes. Everyone does. But over a session, the player who spreads their tokens, counts the danger before stepping out, takes the captures that are worth taking, and plans the endgame will finish ahead far more often than not.</p>
<p>The best way to feel this is to play a few games while consciously asking those questions before each tap. It slows you down at first and then becomes automatic. Try it in your next match on Lotus Ludo and see how much the game opens up.</p>
`),
    },
    {
      id: "b_top-ludo-mistakes", slug: "top-ludo-mistakes", published: true, author: "Lotus Ludo Team", date: "2026-07-14T00:00:00.000Z",
      title: "Top 10 Ludo Mistakes (and How to Stop Making Them)",
      excerpt: "The same handful of errors cost players game after game. Here they are, with the fix for each one.",
      seoTitle: "Top 10 Ludo Mistakes and How to Fix Them | Lotus Ludo",
      seoDesc: "The ten most common Ludo mistakes — rushing one token, ignoring safe squares, chasing captures, poor endgame counting — and how to avoid each.",
      body: P(`
<p>Improving at Ludo is less about learning clever tricks and more about removing the errors you are already making. These ten come up constantly, and each one has a simple fix.</p>
<h2>1. Pushing a single token</h2>
<p>The most common mistake of all. One token far ahead looks like progress, but it means every roll has only one destination — and that token is a lone target. <strong>Fix:</strong> open a second and third token early so you always have a choice.</p>
<h2>2. Ignoring safe squares</h2>
<p>Star squares exist for a reason. Ending a move one square short of safety, when you could have landed on it, hands an opponent a free capture. <strong>Fix:</strong> before you tap, check whether any legal move ends on a star. If one does, it deserves serious consideration.</p>
<h2>3. Chasing every capture</h2>
<p>Captures feel great, but a capture that leaves your token stranded in front of two opponents can lose more than it wins. <strong>Fix:</strong> ask what the board looks like after the capture. If you land somewhere exposed and the value is small, let it go.</p>
<h2>4. Never counting the danger</h2>
<p>An opponent can only reach you from one to six squares back. That is knowable. Most players simply never look. <strong>Fix:</strong> glance behind your token before you move it. Two opponents in range is a genuine risk; none is a free move.</p>
<h2>5. Stacking tokens at your yard exit</h2>
<p>Opponents love camping near your starting square. Piling tokens there gives them a rich target and clogs your own movement. <strong>Fix:</strong> get tokens moving away from the exit rather than parking beside it.</p>
<h2>6. Wasting the extra turn from a 6</h2>
<p>A 6 gives you another roll. Many players immediately spend it on the same token they just moved, out of momentum. <strong>Fix:</strong> treat the bonus roll as a fresh decision. It often belongs to a different token entirely.</p>
<h2>7. Playing only your own colour</h2>
<p>If you watch only your tokens, you will not see the capture coming. <strong>Fix:</strong> spend a second scanning all four colours each turn. Where is the biggest threat? Who is closest to finishing?</p>
<h2>8. Sloppy endgame counting</h2>
<p>A token must land exactly on the final square. Moving a token from needing a 3 to needing a 1 makes it much harder to finish. <strong>Fix:</strong> work out the exact number each token needs and protect those numbers.</p>
<h2>9. Tilting after a bad run</h2>
<p>Three bad rolls in a row do not change the right move on the fourth. Frustrated players start taking wild risks to catch up and lose faster. <strong>Fix:</strong> if you notice yourself playing angrily, finish the game calmly or take a short break.</p>
<h2>10. Forgetting that it is a social game</h2>
<p>The scoreboard is not the whole point. Rushing opponents, sulking in the voice room or leaving a match halfway spoils the game for everyone, including you. <strong>Fix:</strong> say good game, congratulate a good roll, and keep rooms friendly. It genuinely makes the game more enjoyable — and people will want to play with you again.</p>
<h2>Where to start</h2>
<p>Do not try to fix all ten at once. Pick the two that sound most like you, watch for them over your next few games, and let the rest follow. Small corrections compound quickly in Ludo.</p>
`),
    },
    {
      id: "b_voice-room-etiquette", slug: "voice-room-etiquette", published: true, author: "Lotus Ludo Team", date: "2026-07-16T00:00:00.000Z",
      title: "Voice Room Etiquette: How to Be the Person Everyone Wants in the Room",
      excerpt: "Live audio is wonderful when everyone knows the unwritten rules. Here they are, written down.",
      seoTitle: "Voice Room Etiquette — Rules for Live Audio Rooms | Lotus Ludo",
      seoDesc: "Practical voice room etiquette: muting, taking turns, welcoming newcomers, handling disagreements, and hosting a room people enjoy.",
      body: P(`
<p>A voice room lives or dies on how people behave in it. The technology is the easy part; the culture is what makes a room somewhere people come back to. Most of it is common courtesy, but it helps to say it out loud.</p>
<h2>Mute when you are not speaking</h2>
<p>This is the single biggest improvement most people can make. An open microphone picks up your fan, your television, your traffic and your typing, and everyone else hears all of it. Mute by default and unmute to speak. It takes one tap and transforms the room.</p>
<h2>Use headphones</h2>
<p>Speakers cause echo: your microphone picks up everyone else's voices and sends them back around. Headphones or earphones remove the problem entirely and make you far easier to understand.</p>
<h2>Leave gaps</h2>
<p>Online audio always has a small delay, so people cannot read the tiny cues that stop them talking over each other in person. Leave a beat after someone finishes before you start. If you and someone else begin at once, one of you should simply say "go ahead" — it costs nothing and keeps the conversation flowing.</p>
<h2>Welcome newcomers</h2>
<p>Joining a room where everyone already knows each other is intimidating. A simple "hey, welcome" when someone arrives changes their whole experience. Rooms that do this grow; rooms that do not stay small.</p>
<h2>Do not dominate</h2>
<p>If you have been talking for several minutes, ask someone else a question. The best rooms feel like a conversation, not a broadcast. Watch the seats — if someone has been unmuted and waiting, give them space.</p>
<h2>Keep it appropriate</h2>
<p>You do not know who is listening. Keep language and topics suitable for a mixed audience, and steer well clear of anything that would break our Community Guidelines — harassment, hate speech, explicit content or personal attacks. A room can be lively without being unpleasant.</p>
<h2>Disagree without making it personal</h2>
<p>Arguments happen. The line is simple: you can disagree with what someone said, and you cannot attack who they are. If a discussion is getting heated and going nowhere, it is entirely fine to say "let us leave that one" and move on.</p>
<h2>Respect the host</h2>
<p>Hosts and co-hosts are responsible for the room. If a host asks you to change the subject, wait your turn or mute, do it — even if you disagree. If you think a host is acting unfairly, use the report option rather than fighting about it live.</p>
<h2>If you are hosting</h2>
<ul>
<li><strong>Set the tone early.</strong> The way the host behaves in the first ten minutes becomes the room's culture.</li>
<li><strong>Bring people in.</strong> Ask quiet members questions by name. Invite listeners onto a seat.</li>
<li><strong>Act quickly on problems.</strong> Mute or remove someone who is disrupting the room. Waiting makes it worse and drives everyone else away.</li>
<li><strong>Do not abuse the controls.</strong> Muting someone for disagreeing with you is not moderation.</li>
</ul>
<h2>Reporting</h2>
<p>If someone crosses a line, use the in-app report option rather than arguing. Reports reach our moderation team with the context they need, and acting on them is how the platform stays pleasant for everyone.</p>
<p>None of this is complicated. Mute your microphone, make room for other people, be kind to newcomers, and deal with problems calmly. Do that and you will always be welcome.</p>
`),
    },
    {
      id: "b_community-safety-tips", slug: "community-safety-tips", published: true, author: "Lotus Ludo Team", date: "2026-07-18T00:00:00.000Z",
      title: "Community Safety Tips: Protecting Yourself in Social Games",
      excerpt: "Practical, specific advice for keeping your account, your money and your personal information safe.",
      seoTitle: "Community Safety Tips for Online Social Games | Lotus Ludo",
      seoDesc: "How to stay safe in social gaming: protecting personal information, spotting scams, account security, blocking and reporting.",
      body: P(`
<p>Social gaming is at its best when people feel safe. Most of our community is friendly, but any platform with strangers on it attracts a few people looking to take advantage. Here is practical advice for protecting yourself.</p>
<h2>Guard your personal information</h2>
<p>You do not need to share your real full name, home address, workplace, school, or phone number to enjoy a game. Be especially careful with:</p>
<ul>
<li><strong>Your location.</strong> "Which city are you in?" is normal small talk. Your neighbourhood or street is not.</li>
<li><strong>Photographs.</strong> Pictures can reveal more than you intend — a uniform, a street sign, a number plate.</li>
<li><strong>Your daily routine.</strong> Telling a room exactly when you are alone or away from home is information you cannot take back.</li>
</ul>
<p>A genuine friend will never be offended when you keep private things private. Pressure to share is itself a warning sign.</p>
<h2>Recognise the common scams</h2>
<p>They follow a small number of patterns, and once you know them they are easy to spot:</p>
<ul>
<li><strong>"Send me coins and I will send back double."</strong> Nobody has ever sent back double.</li>
<li><strong>"I work for the platform — tell me your password."</strong> We will never ask for your password. Nobody legitimate ever will.</li>
<li><strong>Cheap coins from outside the app.</strong> Buying through anyone but the official purchase screen means no protection, no refund, and often a stolen payment method that gets your account banned.</li>
<li><strong>The urgent story.</strong> A dramatic emergency plus a demand to act immediately is a manipulation technique, not a coincidence.</li>
<li><strong>Links from strangers.</strong> Sign-in pages that "look like" the site are one of the most reliable ways accounts are stolen.</li>
</ul>
<p>The reliable rule: <strong>anything urgent, secret, and involving money or passwords is a scam.</strong> Slow down and it falls apart.</p>
<h2>Secure your account</h2>
<ul>
<li>Use a password you do not use anywhere else. If one site is breached, everything sharing that password is exposed.</li>
<li>Never share your login, even with a friend or a co-host.</li>
<li>Sign out on shared or public devices.</li>
<li>If a login alert arrives that was not you, change your password immediately and contact support.</li>
</ul>
<h2>Use block and report</h2>
<p>You are not obliged to tolerate someone who makes you uncomfortable. Blocking is not rude and needs no justification. Reporting sends the details to our moderation team, who can act across the whole platform rather than just your conversation — so reporting helps the next person too.</p>
<p>Report anything involving threats, harassment, hate speech, sexual content involving minors, scams or attempts at self-harm. If someone appears to be in immediate real-world danger, contact your local emergency services as well; we can act on an account, but we cannot send help to an address.</p>
<h2>Look after each other</h2>
<p>If you see someone being harassed in a room, say something or tell the host. If a newcomer is being pressured for personal details, step in. Communities stay safe because ordinary members refuse to let bad behaviour pass quietly.</p>
<h2>Talk to us</h2>
<p>If you are unsure about a situation, ask. Use the in-app report option or our Contact page and we will help. We would far rather answer a question about something harmless than deal with the aftermath of something that was not.</p>
`),
    },
    {
      id: "b_online-gaming-safety", slug: "online-gaming-safety", published: true, author: "Lotus Ludo Team", date: "2026-07-20T00:00:00.000Z",
      title: "Online Gaming Safety: A Practical Guide for Players and Families",
      excerpt: "Device security, payment safety, privacy settings and healthy habits — everything that keeps online play enjoyable.",
      seoTitle: "Online Gaming Safety Guide — Accounts, Payments & Privacy | Lotus Ludo",
      seoDesc: "A practical online gaming safety guide: securing your device and account, safe payments, privacy settings, and healthy playing habits.",
      body: P(`
<p>Online gaming safety covers more than avoiding unpleasant people. It includes your device, your account, your payments and your wellbeing. This guide walks through each in turn.</p>
<h2>Your device</h2>
<p>Most account compromises start on the device rather than the platform.</p>
<ul>
<li><strong>Keep your phone and browser updated.</strong> Updates are mostly security fixes for problems that are already being exploited.</li>
<li><strong>Install from official stores only.</strong> "Modded" or "cracked" game apps very often carry password stealers.</li>
<li><strong>Lock your screen.</strong> A PIN or biometric lock is what stands between a lost phone and a stranger with your accounts.</li>
<li><strong>Be careful on public Wi-Fi.</strong> Avoid making payments on a network you do not control.</li>
</ul>
<h2>Your account</h2>
<p>Use a unique password. Reusing one password across sites means a breach anywhere becomes a breach everywhere — and breach lists are traded openly. A password manager makes unique passwords effortless; if you would rather not use one, a memorable phrase of three or four unrelated words is both stronger and easier to remember than a short password full of symbols.</p>
<p>Never share your login. No genuine member of staff, host, or administrator will ever ask for your password. Anyone who does is trying to steal your account, whatever they claim.</p>
<h2>Payments</h2>
<ul>
<li><strong>Only ever pay through the official purchase screen.</strong> Coins bought from an individual "reseller" carry no protection at all, and are frequently paid for with stolen cards — which gets the receiving account banned.</li>
<li><strong>Keep your receipts.</strong> A transaction ID makes any payment question quick to resolve.</li>
<li><strong>Check your statements.</strong> Query anything you do not recognise with us and with your bank promptly.</li>
<li><strong>Set your own limit before you start,</strong> not after.</li>
</ul>
<h2>Privacy</h2>
<p>Think about what your profile says about you. A username that is also your email address, a photograph that shows your street, or a bio listing your school all give away more than you might intend. Review your profile occasionally and ask what a stranger could work out from it.</p>
<p>You can request a copy of the personal data we hold about you, or ask us to delete your account, at any time — see our <a href="/legal/privacy">Privacy Policy</a> for how.</p>
<h2>For parents and guardians</h2>
<p>Lotus Ludo is intended for players aged 18 and over. If you are responsible for a younger person who games elsewhere, the advice that works best is not surveillance but conversation: know which platforms they use, agree what is and is not shared with strangers, keep payment details off shared devices, and make sure they know they can tell you about something uncomfortable without being blamed or losing access.</p>
<h2>Healthy habits</h2>
<p>Safety includes your own wellbeing. Decide how long you want to play before you start. Take a break every hour or so. Notice if you are playing to escape something rather than to enjoy yourself, or chasing a loss with a purchase — both are worth pausing on. Games should leave you feeling better, not worse.</p>
<h2>If something goes wrong</h2>
<p>Act quickly. Change your password, check for unfamiliar sessions or purchases, and contact us through the <a href="/legal/contact">Contact page</a> with as much detail as you can. Report the account involved so our moderation team can act. Most problems are far easier to fix in the first hour than the first week.</p>
`),
    },
    {
      id: "b_fair-play-multiplayer", slug: "fair-play-in-multiplayer-games", published: true, author: "Lotus Ludo Team", date: "2026-07-22T00:00:00.000Z",
      title: "Fair Play in Multiplayer Games: Why It Matters and How We Protect It",
      excerpt: "A multiplayer game is only worth playing if everyone believes it is honest. Here is what fair play means in practice.",
      seoTitle: "Fair Play in Multiplayer Games — How We Protect It | Lotus Ludo",
      seoDesc: "What fair play means in multiplayer games: server-side dice, anti-collusion, no boosting, and how to report suspected cheating.",
      body: P(`
<p>Every multiplayer game rests on a single assumption: that the result was honest. Take that away and nothing else matters — not the design, not the prizes, not the community. This article explains what fair play means on Lotus Ludo and how it is protected.</p>
<h2>The dice are decided by the server</h2>
<p>This is the foundation. When you roll, your device does not choose the number — it asks our server, and the server decides. Nothing running on a phone or in a browser can influence the result, because the result was never calculated there.</p>
<p>That matters because client-side randomness is the easiest thing in the world to tamper with. By keeping the roll on the server, a modified app cannot produce better dice; it can only display what it is told.</p>
<h2>Randomness is genuine, and paid games are protected</h2>
<p>Random means random: every face has its fair chance, and previous rolls do not change the next one. A run of sixes feels suspicious precisely because real randomness is streaky — but the streak has no memory and no meaning.</p>
<p>Where a game costs coins to join, or carries a tournament reward, the outcome is forced to pure randomness with no adjustment of any kind. That is exactly where fairness has to be absolute.</p>
<h2>What counts as cheating</h2>
<ul>
<li><strong>Modified clients.</strong> Any altered app or script used to gain an advantage.</li>
<li><strong>Collusion.</strong> Players secretly cooperating in a game or tournament that is supposed to be individual — including deliberately losing to feed another account.</li>
<li><strong>Multiple accounts.</strong> Entering the same competition twice, or using extra accounts to farm rewards.</li>
<li><strong>Account sharing and boosting.</strong> Having a stronger player play on your account.</li>
<li><strong>Exploiting bugs.</strong> Finding a fault is fine and we are grateful for the report. Repeatedly using it for gain is not.</li>
<li><strong>Result manipulation.</strong> Stalling, disconnecting deliberately, or pressuring an opponent into conceding.</li>
</ul>
<h2>What happens when someone is caught</h2>
<p>Consequences scale with what happened. A first, minor offence usually brings a warning and the reversal of anything gained. Serious or repeated cheating — particularly in paid games or tournaments — leads to forfeited prizes, removal from competitions, and suspension or permanent closure of the account. Coordinated fraud is treated as fraud.</p>
<p>Reversing unfair gains matters as much as the penalty itself. Cheating that is punished but still profitable is not really punished.</p>
<h2>Fair play is also about behaviour</h2>
<p>Not everything unfair is technical. Deliberately stalling to frustrate an opponent, abusing a host's controls to influence a game, or harassing someone into playing badly all break the same principle. Fair play means the result reflects how people played, not who was most unpleasant.</p>
<h2>How to report it</h2>
<p>If you suspect cheating, report it rather than accusing someone publicly in a room. Use the in-app report option or our <a href="/legal/contact">Contact page</a>, and include:</p>
<ul>
<li>The username or User ID of the account involved</li>
<li>When it happened, as precisely as you can</li>
<li>Which room, game or tournament</li>
<li>What you saw, and a screenshot or recording if you have one</li>
</ul>
<p>Public accusations are usually wrong, and they poison rooms even when they are right. A report reaches people who can actually check the game records.</p>
<h2>A word on losing</h2>
<p>Ludo has real variance. Everyone has games where nothing lands and it feels rigged. It is worth saying plainly: a bad run is not evidence of cheating, and the mathematics of randomness guarantee that unlikely-feeling sequences happen regularly. Report genuine suspicions, by all means — but a losing streak on its own is just Ludo.</p>
`),
    },
    {
      id: "b_benefits-social-gaming", slug: "benefits-of-social-gaming", published: true, author: "Lotus Ludo Team", date: "2026-07-24T00:00:00.000Z",
      title: "The Benefits of Social Gaming: More Than Just Passing Time",
      excerpt: "Playing together does something that playing alone does not. Here is what social gaming actually offers.",
      seoTitle: "Benefits of Social Gaming — Connection, Skills & Wellbeing | Lotus Ludo",
      seoDesc: "The real benefits of social gaming: staying connected, building skills, easing isolation, and playing in a way that stays healthy.",
      body: P(`
<p>Social gaming — playing with other people rather than against a machine — has grown enormously, and not only because games got better. It fills a genuine need. Here is what it offers, and how to get the good parts without the pitfalls.</p>
<h2>It keeps people connected</h2>
<p>Friends move away. Families end up in different cities and time zones. Work takes over evenings. A shared game is one of the easiest ways to keep a relationship going, because it gives you something to do together rather than an obligation to fill silence.</p>
<p>A twenty-minute game of Ludo with a cousin abroad is not a substitute for seeing them, but it is a far better thread than an occasional message. Many people find they talk more freely while playing than they would on a call, precisely because the game carries the conversation.</p>
<h2>It is easier than starting a conversation</h2>
<p>Meeting new people is hard, and it is hardest for those who find social situations draining. A game removes most of that difficulty. There is a shared activity, an obvious thing to talk about, and a natural end point. Voice rooms built around a game feel far less exposing than a room built around nothing.</p>
<h2>It sharpens real skills</h2>
<p>Ludo looks simple and is not. Played well it involves probability, planning several moves ahead, weighing risk against reward, and reading what opponents are likely to do. Playing with others adds communication, patience, and the ability to lose gracefully — which is a genuine skill and a rarer one than it should be.</p>
<p>Hosting develops more still: keeping a group comfortable, handling disagreement calmly, making newcomers feel welcome. These transfer well beyond the game.</p>
<h2>It helps with isolation</h2>
<p>For people who live alone, work unusual hours, have limited mobility, or are going through a period where leaving the house is hard, a friendly room where people know your name matters. It is not a replacement for company in person, and nobody should pretend it is — but "not the same as" is very different from "worthless". For a lot of people it is the difference between a quiet evening and a lonely one.</p>
<h2>It crosses distance and generations</h2>
<p>Traditional board games have a rare quality: everybody already knows them. Ludo is played across dozens of countries and by every age group, which makes it one of the few things a teenager and a grandparent can genuinely enjoy on equal terms. Take that online and geography stops mattering too.</p>
<h2>Keeping it healthy</h2>
<p>The benefits are real, and so are the ways they can tip over. A few habits keep the balance:</p>
<ul>
<li><strong>Decide your time before you start.</strong> "One more game" is how three hours disappear.</li>
<li><strong>Notice why you are playing.</strong> Playing to enjoy yourself and playing to avoid something feel different. The second one is worth paying attention to.</li>
<li><strong>Keep spending deliberate.</strong> Set a limit before you open the purchase screen, not after a loss.</li>
<li><strong>Do not let it replace everything else.</strong> Online friendships are real, and they work best alongside the offline ones rather than instead of them.</li>
<li><strong>Take breaks.</strong> Stand up, look away from the screen, come back fresher.</li>
</ul>
<p>Read our <a href="/legal/responsible-gaming">Responsible Gaming Policy</a> for more, including the tools available if you want to step back.</p>
<h2>The short version</h2>
<p>Social gaming is at its best when it adds to your life — a way to stay close to people who are far away, meet new ones without the awkward part, and spend an hour doing something enjoyable with company. Play with people you like, keep it within limits that suit you, and it is a genuinely good way to spend some of your time.</p>
`),
    },
    {
      id: "b_how-lotus-ludo-works", slug: "how-lotus-ludo-works", published: true, author: "Lotus Ludo Team", date: "2026-07-26T00:00:00.000Z",
      title: "How Lotus Ludo Works: A Complete Tour of the Platform",
      excerpt: "Accounts, rooms, games, tournaments, coins, levels and safety — how every part of Lotus Ludo fits together.",
      seoTitle: "How Lotus Ludo Works — Full Platform Guide | Lotus Ludo",
      seoDesc: "A complete guide to how Lotus Ludo works: creating an account, voice rooms, games, tournaments, coins and gifts, levels, and safety tools.",
      body: P(`
<p>Lotus Ludo brings several things together — classic board games, live voice rooms, tournaments, gifting and a community — and it is not always obvious how they connect. This is the full tour.</p>
<h2>Getting an account</h2>
<p>You can sign up with a username and password, with your mobile number and a one-time code, or with Google. New accounts are reviewed before they become active, which is a deliberate choice: it is a simple, effective barrier against bulk fake accounts, and it keeps the community cleaner than open registration would.</p>
<p>Once you are in, you can set a display name, a profile picture and a short bio. Everything runs in your browser — there is no heavy download — and it installs to your phone's home screen in one tap if you want it to feel like an app.</p>
<h2>Voice rooms</h2>
<p>Voice rooms are the heart of the platform: live audio spaces where people talk, host and meet in real time.</p>
<ul>
<li><strong>Seats</strong> are the speaking positions. Take a free seat to join the conversation.</li>
<li><strong>Listeners</strong> can be in a room without a seat, hearing everything and using the text chat.</li>
<li><strong>The host</strong> created the room and controls it. <strong>Co-hosts</strong> are trusted helpers with most of the same controls.</li>
<li><strong>Text chat</strong> runs alongside the audio, so people who cannot or would rather not speak are still fully part of things.</li>
</ul>
<p>Hosts can manage seats, invite people, mute someone who is disrupting the room, and remove them if necessary. Rooms can be public or private, and each one carries its own settings and appearance.</p>
<h2>Games</h2>
<p>Games run inside rooms, so you can talk while you play. Ludo is the centrepiece, with an animated board, customisable tokens and themes. Other games are available depending on what the room has enabled.</p>
<p>The important technical point: <strong>the dice are decided by our server, never by your device.</strong> Nothing running on a phone can influence a roll. Games that cost coins to join, and games with a reward, use pure randomness with no adjustment at all.</p>
<p>If you would rather watch than play, spectator mode lets you follow a live board without joining the match.</p>
<h2>Tournaments</h2>
<p>Tournaments turn casual play into a competition:</p>
<ol>
<li>Find an upcoming tournament and request to join.</li>
<li>The host reviews and approves entrants.</li>
<li>When it begins, match rooms are created automatically and players assigned.</li>
<li>A room runs until the required number of players qualify; the rest are eliminated.</li>
<li>The next round is generated automatically from the qualifiers, and so on.</li>
<li>The last player standing is champion, and prizes go to the top places.</li>
</ol>
<p>Where joining a tournament costs coins, those coins are held rather than spent immediately — so if it is cancelled, they are returned.</p>
<h2>Coins, gifts and the wallet</h2>
<p>Coins are a virtual in-app item. They are used for gifts and some optional features, and they have <strong>no value outside the platform</strong> — they are not money and cannot be exchanged for it.</p>
<p>You can obtain coins by buying them through the official purchase screen, or earn free rewards through daily claims, referrals and activity. Gifts are the main social use: sending an animated gift to a speaker you are enjoying is the platform's version of applause.</p>
<p>Your wallet shows every transaction. Please see our <a href="/legal/coin-purchase">Coin Purchase Policy</a> and <a href="/legal/refund">Refund Policy</a> before buying.</p>
<h2>Levels and rewards</h2>
<p>Playing, winning, gifting and logging in earn experience, which raises your level. Levels unlock badges and cosmetic rewards and appear beside your name. It is a recognition system rather than a power system — a higher level never gives an advantage in a game.</p>
<h2>Agencies</h2>
<p>Agencies are groups that organise hosts and members, with their own levels and reporting. If you host regularly, joining one connects you to a wider network; if you simply want to play, you can ignore agencies entirely.</p>
<h2>Safety and moderation</h2>
<p>Every room, message, profile and piece of content can be reported from within the app. Reports reach our moderation team with the context needed to act. Hosts moderate their own rooms; administrators can act across the whole platform.</p>
<p>Our <a href="/legal/community">Community Guidelines</a> set out what is and is not acceptable, and our <a href="/legal/safety-moderation">Safety &amp; Moderation Policy</a> explains how reports are handled and what happens next.</p>
<h2>Your data</h2>
<p>You can edit your profile at any time, request a copy of the personal data we hold about you, and ask for your account to be deleted. Our <a href="/legal/privacy">Privacy Policy</a> explains exactly what is collected, why, how long it is kept, and how to make a request.</p>
<h2>Getting help</h2>
<p>The in-app Support section opens a ticket that reaches our team directly, and the <a href="/legal/contact">Contact page</a> works whether or not you can sign in. Every enquiry is acknowledged within 24 hours.</p>
<p>That is the whole platform. The best way to understand it is to join a room, take a seat and say hello — most of it makes immediate sense once you are in one.</p>
`),
    },
  ],
};
