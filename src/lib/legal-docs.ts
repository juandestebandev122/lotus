// ============================================================================
// THE PUBLIC LEGAL PAGES — and how the admin takes control of them.
//
// /legal/terms, /legal/privacy, /legal/refund, /legal/community and
// /legal/contact shipped as hard-coded React pages. Nothing on them could be
// edited from the panel — not even the Grievance Officer's name, e-mail and
// address, which are legally required to be real and were still placeholders.
//
// Those pages now render an ADMIN-MANAGED document (Admin → Policies & Terms)
// whenever one exists for their slug, and fall back to the built-in text when it
// doesn't. So nothing changed for a fresh install, and the moment an admin
// "takes over" a page they get full edit / add / delete control over it.
// ============================================================================

export interface LegalDocMeta {
  /** Matches the policy slug the admin edits. */
  slug: string;
  title: string;
  /** Where the page lives publicly. */
  href: string;
  /** A ready-to-edit starting point when the admin takes the page over. */
  starter: string;
  /**
   * "legal"  → a policy page under /legal/…
   * "guide"  → a how-to page under /guides/…
   * Pages marked `builtIn` have their own hand-written React page; the rest are
   * rendered by the shared [slug] routes from the `starter` text below, so a new
   * page needs no new file.
   */
  section?: "legal" | "guide";
  builtIn?: boolean;
  /** Short line used for the page's meta description (search results). */
  description?: string;
}

/** Simple, admin-friendly formatting understood by the policy renderer. */
export const LEGAL_FORMAT_HELP = [
  "## Heading            → a section heading",
  "- point               → a bullet point",
  "[img]<url>[/img]      → a picture (use the Add image button)",
  "A blank line          → starts a new paragraph",
].join("\n");

export const LEGAL_DOCS: LegalDocMeta[] = [
  {
    slug: "contact",
    title: "Contact Us",
    href: "/legal/contact",
    section: "legal",
    builtIn: true,
    starter: `We're here to help. For support, questions, or to raise a grievance, please use the details below.

## General Support
- Email: support@lotusplay.tech
- Website: lotusplay.tech

## Grievance Officer
In accordance with the Information Technology Act, 2000 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the contact details of our Grievance Officer are:

- Name: YOUR GRIEVANCE OFFICER'S NAME
- Email: grievance@lotusplay.tech
- Address: YOUR REGISTERED BUSINESS ADDRESS

## How We Handle Complaints
- We acknowledge complaints within 24 hours of receipt.
- We aim to resolve complaints within 15 days.
- To help us assist you quickly, include your account email/username and a clear description of the issue (with the transaction ID for payment matters).

## Reporting Illegal or Harmful Content
To report content that is illegal or violates our Community Guidelines, use the in-app report option or email our Grievance Officer. We remove unlawful content upon becoming aware of it and after receiving valid legal orders.`,
  },
  {
    slug: "community",
    title: "Community Guidelines",
    href: "/legal/community",
    section: "legal",
    builtIn: true,
    starter: `LotusPlay Connect is a place to hang out, talk, and play together. To keep it safe and welcoming for everyone, all users must follow these Community Guidelines. Breaking them may lead to content removal, warnings, suspension, or a permanent ban.

## Be Respectful
- Treat others with respect. No harassment, bullying, or threats.
- No hate speech or discrimination based on religion, caste, gender, race, ethnicity, disability, or any other protected characteristic.

## Prohibited Content & Behaviour
The following are strictly not allowed:

- Hate speech.
- Threats and harassment.
- Obscene, sexually explicit, or otherwise inappropriate content.
- Terrorist propaganda or content promoting violence or self-harm.
- Impersonation of any person or organisation.
- Promotion of illegal gambling.
- Distribution of illegal content, including content that infringes others' rights.
- Spam, scams, fraud, or attempts to deceive other users.

## Reporting
Use the in-app report option on any room, message, or profile. Our moderation team reviews reports and takes action where the rules have been broken.`,
  },
  {
    slug: "refund",
    title: "Refund Policy",
    href: "/legal/refund",
    section: "legal",
    builtIn: true,
    starter: `This Refund Policy explains how refunds work for virtual coins and premium features on LotusPlay Connect (lotusplay.tech).

## 1. Virtual Coins & Digital Goods
- Coins and digital items are delivered to your account immediately after a successful payment.
- Because they are delivered instantly and consumed digitally, purchases are generally not refundable once credited, except as required by law or as set out below.

## 2. When You May Be Eligible for a Refund
- Failed or duplicate transactions: if money was deducted but coins were not credited, or you were charged more than once for the same purchase.
- Unauthorised transactions: if a payment was made without your authorisation.
- Technical errors on our side that prevented you from receiving what you paid for.

## 3. How to Request a Refund
- Contact us via the Contact Us page within 7 days of the transaction.
- Include your account email/username, the transaction ID, the date, and a description of the problem.

## 4. Processing & Timelines
- We review refund requests and respond within a reasonable period.
- Approved refunds are returned to the original payment method.`,
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    href: "/legal/terms",
    section: "legal",
    builtIn: true,
    starter: `These Terms & Conditions govern your use of LotusPlay Connect. By creating an account you agree to them.

## Eligibility
- You must be 18 years or older to use this platform.

## Your Account
- Keep your login details secure. You are responsible for activity on your account.
- Do not impersonate anyone or create accounts to evade a ban.

## Virtual Coins
- Coins are a virtual in-app item with no cash value outside the platform.

## Ending Access
We may suspend or close accounts that break these terms or our Community Guidelines.`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    href: "/legal/privacy",
    section: "legal",
    builtIn: true,
    starter: `This Privacy Policy explains what we collect, why, and what choices you have.

## What We Collect
- Account details you provide (name, username, email, mobile number).
- Usage information needed to run the service (rooms joined, games played).

## How We Use It
- To provide and secure the service, and to support you when you contact us.

## Your Choices
- You can edit your profile details at any time, and contact us to request deletion of your account.`,
  },

  // ==========================================================================
  // Pages WITHOUT their own React file. The shared /legal/[slug] and
  // /guides/[slug] routes render the text below, and an admin can take any of
  // them over from Admin → Policies & Terms exactly like the five above.
  // ==========================================================================
  {
    slug: "rules",
    title: "Rules & Regulations",
    href: "/legal/rules",
    section: "legal",
    description: "The complete rules of Lotus Ludo — accounts, gameplay, voice rooms, chat, coins, tournaments and the penalties for breaking them.",
    // EVERY rule below is one the platform actually enforces. Where a rule is an
    // admin-configurable setting rather than a fixed behaviour, it says so — the
    // client asked that the rules be verified as implemented, not just written.
    starter: `These Rules & Regulations are the complete set of rules for using Lotus Ludo. They apply to everyone, on every part of the platform. Breaking them can cost you access to a feature, a room, a prize, or your account.

This page is written in plain language and gathers the rules in one place. The formal agreement is the Terms & Conditions, and specific areas have their own detailed policies, linked at the end.

## 1. Who May Use Lotus Ludo
- You must be 18 YEARS OR OLDER. Your date of birth is checked when you register and an under-18 date is refused.
- One person, one account. Extra accounts used to enter a competition twice, farm rewards or evade a restriction are removed.
- You must give a real email address and a working mobile number.
- New accounts require EMAIL VERIFICATION and then ADMIN APPROVAL. You cannot enter the app until both are done.
- You must accept the Terms & Conditions and every policy marked as required when you register.

## 2. Your Account
- Your username must be 3 to 20 characters, using only letters, numbers, full stops and underscores.
- Your password must be at least 8 characters. Use one you do not use anywhere else.
- Keep your login private. You are responsible for everything done from your account.
- NEVER share your password. No administrator, host or member of staff will ever ask for it. Anyone who does is trying to steal your account.
- Do not impersonate another person, an organisation, or our staff.
- Do not create an account to get around a suspension or ban.
- Do not buy, sell, rent or transfer an account.

## 3. How You Treat Other People
- Treat everyone with respect. No harassment, bullying, threats or intimidation.
- No hate speech or discrimination based on religion, caste, gender, race, ethnicity, nationality, disability or any other protected characteristic.
- No sexually explicit content. Any sexual content involving a minor is reported to the authorities and the account is closed permanently and immediately.
- No content promoting violence, terrorism, self-harm or suicide.
- Do not share anyone else's private information without their consent.
- No spam, mass unsolicited messaging or repetitive advertising.
- No scams, phishing, fraud or attempts to deceive other members.

## 4. Voice Rooms
- Mute your microphone when you are not speaking, and use headphones to avoid echo.
- The HOST controls their room. Co-hosts share most of those controls. If a host asks you to change the subject, wait your turn or mute, do it.
- An ADMINISTRATOR outranks a host everywhere. A host cannot mute or silence an administrator.
- Hosts may mute, remove or block a member from their room. Removal is rejoinable; a block is permanent for that room.
- Do not abuse host controls. Muting someone for disagreeing with you is not moderation.
- Where a room has AUTO-LOCK enabled, the chat locks for ordinary members whenever no host or co-host is present. This is an admin setting, shown on screen when it is on.
- Where SEAT APPROVAL is set to manual, the host approves each request to take a seat.
- Treat anything you say in a room as public to that room. If a room is being recorded, you are told on screen before you speak.

## 5. Games
- GAME OUTCOMES ARE DECIDED BY OUR SERVER, never by your device. Nothing running on a phone or in a browser can change a dice roll.
- Games that cost coins to join, and all tournament matches, use pure randomness with no adjustment of any kind.
- Virtual coins have no cash value and cannot be exchanged for real money. Rewards are paid in coins, so nothing on this platform is played for money.
- Each turn has a time limit, set by the administrator. Miss your turn and you lose a chance.
- MISS THREE TURNS AND YOU ARE REMOVED from that game. Your tokens leave the board and play continues without you. We do NOT play moves for you — an automatic move would often be a bad one, and a result should reflect decisions you actually made.
- Rolling three sixes in a row ends your turn, and the third six is not played.
- Leaving a game in progress counts as forfeiting it.
- Only members seated in a voice room can start or join a game from it. Listeners can watch.
- No modified apps, scripts or bots. No collusion. No account sharing or boosting. No deliberate stalling or disconnecting to affect a result. See the Fair Play Policy.
- Finding a bug is welcome and we are grateful for the report. Repeatedly exploiting one for gain is not.

## 6. Tournaments
- One account per person per tournament.
- The host approves entries. Only approved players take part.
- Where joining costs coins, those coins are HELD when you register, not spent. If the tournament is cancelled or your entry is not approved, they are returned in full.
- Be present when your match room opens. Not joining within the joining window forfeits that match.
- Being removed from a match for inactivity eliminates you from the tournament.
- Prizes go to the places listed on the tournament page and are credited after the tournament is confirmed complete.
- A player disqualified for breaking these rules forfeits any prize, which may pass to the next eligible place.
- Raise any dispute within 48 HOURS, through the Contact page. See the Tournament Rules.

## 7. Coins and Payments
- Virtual coins have no cash value and cannot be exchanged for real money. They are a virtual in-app item, and cannot be transferred off the platform.
- You never need to spend money to play. Games and rooms are free.
- Buy coins ONLY through the official purchase screen. Coins bought from another member, a reseller or any outside site carry no protection at all, are often paid for with stolen cards, and get the receiving account banned.
- You must be the authorised holder of the payment method, or have the holder's permission.
- Coins are credited immediately after payment. Every purchase appears in your wallet history.
- Because coins are delivered instantly and consumed digitally, purchases are generally not refundable once credited — see the Refund Policy for the exceptions, which include failed, duplicate and unauthorised payments.
- Talk to us before raising a chargeback with your bank. Almost every payment issue is settled far faster that way.
- If an account is closed for breaking these rules, any remaining coin balance is forfeited.

## 8. Content You Upload
- You must own what you upload, or have permission to use it.
- Do not upload anything that infringes someone else's copyright, trademark or other rights.
- Do not upload anything illegal, or anything that breaks section 3.
- We may remove content that breaks these rules, and may restrict the account that posted it.
- Profile pictures may require approval before they appear, where the administrator has enabled that.

## 9. Reporting and Moderation
- Use the in-app report option on any room, message, profile, game or piece of content. It sends us the surrounding context automatically.
- Include the username, when it happened, where, and a screenshot if you have one.
- Reports are confidential. We do not tell the reported person who reported them.
- Retaliating against someone for reporting is itself a breach of these rules.
- Deliberately false or malicious reports are also a breach.
- We aim to review reports within 24 hours, and immediately where someone's safety is at risk.
- If someone is in immediate danger, contact your local emergency services FIRST. We can act on an account; we cannot send help to an address.

## 10. What Happens If You Break the Rules
Action is proportionate, and escalates with how serious the breach is and whether it is repeated:

- The content is removed.
- A warning.
- Being muted or removed from a room.
- A feature restricted — chat, voice, media, gifting or games.
- The account suspended temporarily.
- The account closed permanently, with any balance forfeited where the closure is for fraud or a serious breach.
- Anything gained unfairly is reversed, and we try to restore the position of the players affected.

Serious matters — anything involving a child, credible threats of violence, or fraud — are escalated immediately and may be referred to law enforcement.

## 11. Appeals
If you believe a decision was wrong, contact us through the Contact page with your username, what happened, and why you think it was mistaken. Wherever possible a different reviewer looks at it, and we will tell you the outcome. We cannot discuss decisions about someone else's account with you.

Please note: a losing streak is not evidence of cheating. Ludo has real variance, and unlikely-feeling runs are a normal part of randomness.

## 12. Changes to These Rules
We may update these Rules & Regulations. The "Last updated" date at the top shows when they last changed, and we will tell you through the platform before a significant change takes effect. Continuing to use Lotus Ludo after a change means you accept the updated rules.

## 13. The Detailed Policies
- Terms & Conditions — the formal agreement between you and us.
- Community Guidelines — how we expect people to behave.
- Fair Play Policy — how game results are protected and what counts as cheating.
- Safety & Moderation Policy — how reports are handled and what actions we take.
- User Reporting Policy — how to report something, and what happens next.
- Responsible Gaming Policy — playing in a way that stays enjoyable.
- Coin Purchase Policy and Refund Policy — buying coins, and getting money back.
- Privacy Policy — what we collect, why, and your rights.
- Tournament Rules and Ludo Rules Guide — the rules of play in detail.

## 14. Contact
Questions about these rules? Use the Contact page at https://lotusplay.tech/legal/contact or email support@lotusplay.tech`,
  },
  {
    slug: "fair-play",
    title: "Fair Play Policy",
    href: "/legal/fair-play",
    section: "legal",
    description: "How Lotus Ludo keeps games honest: server-decided dice, what counts as cheating, and the consequences for breaking the rules.",
    starter: `Every multiplayer game depends on one thing: that the result was honest. This policy explains how we protect that on Lotus Ludo, what counts as cheating, and what happens to accounts that break the rules.

## How Game Results Are Decided
- Dice rolls and other random outcomes are generated on our SERVER, never on your phone or in your browser. A modified app cannot change a roll, because the roll was never calculated on your device.
- Randomness is genuine: every outcome has its fair chance, and earlier rolls never change later ones.
- Games that cost coins to join, and all tournament matches, use pure randomness with no adjustment of any kind.
- Virtual coins have no cash value and cannot be exchanged for real money. Rewards are paid in coins, so nothing on this platform is played for money.
- Game results, dice rolls and match outcomes are logged, so a disputed game can be checked against the record.

## What Counts as Cheating
- Using a modified app, script, bot or any tool intended to gain an advantage.
- Collusion — secretly cooperating with another player in a game or tournament meant to be individual, including deliberately losing to feed another account.
- Using more than one account to enter the same competition, or to farm rewards.
- Account sharing or boosting: allowing someone else to play on your account.
- Deliberately and repeatedly exploiting a bug. Finding a fault and reporting it is welcome; using it for gain is not.
- Manipulating a result by stalling, disconnecting on purpose, or pressuring an opponent into conceding.
- Buying, selling or transferring accounts.

## Fair Behaviour, Not Only Fair Software
Not everything unfair is technical. Deliberately wasting an opponent's time, abusing host controls to influence a game, or harassing someone into playing badly all break the same principle. A fair result reflects how people played.

## Consequences
Action is proportionate to what happened and whether it is repeated:

- A first minor breach: a warning, and the reversal of anything gained unfairly.
- A serious or repeated breach: removal from the competition, forfeiture of prizes, and temporary suspension.
- Severe or coordinated cheating, or any attempt at fraud: permanent closure of the account and forfeiture of any balance obtained through it.

Reversing unfair gains matters as much as the penalty. We will always try to restore the position of players who were affected.

## Reporting Suspected Cheating
Report it rather than accusing anyone publicly in a room. Use the in-app report option or our Contact page, and include:

- The username or User ID involved.
- When it happened, as precisely as you can.
- Which room, game or tournament.
- What you saw, with a screenshot or recording if you have one.

## Appeals
If you believe action was taken against you in error, contact us with your username and what happened. We will review the game records and reply. A losing streak on its own is not evidence of cheating — Ludo has genuine variance, and unlikely-feeling runs are a normal part of randomness.`,
  },
  {
    slug: "responsible-gaming",
    title: "Responsible Gaming Policy",
    href: "/legal/responsible-gaming",
    section: "legal",
    description: "Playing Lotus Ludo in a way that stays enjoyable: age limits, spending limits, taking breaks, and how to get support.",
    starter: `Lotus Ludo is entertainment. This policy explains how we help keep it that way, and what to do if playing stops feeling good.

## Who May Use Lotus Ludo
- Lotus Ludo is for players aged 18 and over.
- Accounts found to belong to someone under 18 are closed.
- If you believe a minor is using the platform, please report it so we can act.

## Coins Are Not Money
- Coins are a virtual in-app item used for gifts and some optional features.
- Virtual coins have no cash value and cannot be exchanged for real money. Buying them is a purchase of entertainment: they are not an investment and give no financial return.
- You never need to spend money to play. The games and the rooms are free.

## Play Within Your Means
- Decide how much time and money you are comfortable with BEFORE you start, not after a loss.
- Never spend money you need for essentials.
- Do not try to win back what you have spent. Outcomes are random, and spending more does not make a result more likely.
- Take a break at least every hour.

## Signs Worth Paying Attention To
Consider stepping back if you notice any of these:

- Playing for longer than you meant to, regularly.
- Spending more than you planned, or hiding what you spend.
- Playing to escape stress, low mood or boredom rather than to enjoy it.
- Neglecting work, study, sleep or people because of playing.
- Feeling irritable or anxious when you cannot play.
- Borrowing money to buy coins.

## Tools Available to You
- Your wallet shows every transaction, so you can see exactly what you have spent.
- You can remove saved payment details at any time.
- You can request a temporary break from your account, or permanent closure, by contacting support.
- If you ask us to close your account for wellbeing reasons, we will not send you promotional messages afterwards.

## Getting Support
If gaming or spending is causing you difficulty, please talk to someone. Speak to your doctor, a counsellor, or a support organisation in your country — many offer free, confidential help. You can also contact us and we will help you limit or close your account, no questions asked.

## For Family Members
If you are worried about someone else's play, contact us with as much detail as you can. We cannot discuss another person's account with you, but we can act on genuine concerns about age or wellbeing.`,
  },
  {
    slug: "coin-purchase",
    title: "Coin Purchase Policy",
    href: "/legal/coin-purchase",
    section: "legal",
    description: "What coins are, how to buy them safely, pricing and delivery, and what to do if a payment goes wrong.",
    starter: `This policy explains what virtual coins are on Lotus Ludo, how to buy them, and what happens if something goes wrong with a payment. Please read it together with our Refund Policy and Terms & Conditions.

## What Coins Are
- Coins are a virtual in-app item, used for gifts and certain optional features.
- Virtual coins have no cash value and cannot be exchanged for real money. They are not money, not a deposit, and not an investment.
- Coins cannot be exchanged for cash, transferred off the platform, or sold to anyone else.
- You do not need coins to play. Games and rooms are free.

## Who May Buy
- You must be 18 or over, and the account holder.
- You must be the authorised holder of the payment method used, or have the account holder's permission.
- Buying coins with someone else's payment details without permission is fraud, and results in permanent closure of the account.

## How to Buy
- Buy ONLY through the official purchase screen inside Lotus Ludo.
- Never buy coins from another user, a reseller, a social media seller or any third-party site. Those purchases carry no protection, are frequently paid for with stolen cards, and result in the receiving account being banned.
- We will never ask for your password or your full card details over chat, email or a voice room.

## Prices and Payment
- Prices are shown before you confirm, in the currency displayed on the purchase screen, and include any taxes where applicable.
- Payments are processed by third-party payment providers. We do not store your full card number.
- Prices, bonus offers and coin bundles may change at any time. The price shown at the moment you confirm is the price that applies.

## Delivery
- Coins are credited to your wallet immediately after the payment is confirmed.
- If a payment succeeds but coins do not arrive within 30 minutes, contact support with your transaction ID.
- Every purchase appears in your wallet history.

## Failed, Duplicate or Unauthorised Payments
- If money was taken but no coins arrived, contact us with the transaction ID and we will investigate.
- If you were charged more than once for the same purchase, we will refund the duplicate.
- If a payment was made from your account without your authorisation, contact us and your bank immediately.

## Refunds
Because coins are delivered instantly and consumed digitally, purchases are generally not refundable once credited — except in the situations set out in our Refund Policy, or where the law requires otherwise. Please read the Refund Policy before buying.

## Chargebacks
If you dispute a payment with your bank rather than contacting us first, the account may be suspended while it is resolved. Please talk to us first — most issues are settled far faster that way.

## Loss of Coins
- Coins are tied to your account and cannot be moved to another one.
- If an account is closed for breaking our Terms or Community Guidelines, any remaining coin balance is forfeited.
- If you close your account voluntarily, unused coins are not refundable.

## Questions
Contact us through the Contact page with your username, the transaction ID and the date, and we will help.`,
  },
  {
    slug: "safety-moderation",
    title: "Safety & Moderation Policy",
    href: "/legal/safety-moderation",
    section: "legal",
    description: "How Lotus Ludo is moderated: what is not allowed, who reviews reports, what actions we take, and how to appeal.",
    starter: `This policy explains how Lotus Ludo is moderated — what we act on, who does it, how quickly, and what you can do if you disagree with a decision. It works alongside our Community Guidelines, which set out the rules themselves.

## Our Approach
We aim for a platform that is lively and welcoming at the same time. That means acting quickly on behaviour that harms people, while not policing ordinary disagreement or humour. Moderation decisions are based on what was actually said or done, not on who reported it.

## What We Act On
- Harassment, bullying, threats and intimidation.
- Hate speech or discrimination based on religion, caste, gender, race, ethnicity, nationality, disability or any other protected characteristic.
- Sexually explicit content, and ANY sexual content involving minors — which is reported to the authorities and results in immediate permanent closure.
- Content promoting violence, terrorism, self-harm or suicide.
- Scams, fraud, phishing and attempts to steal accounts or payment details.
- Impersonation of another person, an organisation, or our own staff.
- Sharing someone else's private information without their consent.
- Spam, mass unsolicited messaging and repetitive advertising.
- Cheating in games — see our Fair Play Policy.
- Anything unlawful under applicable law.

## Who Moderates
- HOSTS and CO-HOSTS moderate their own rooms. They can mute, remove and block members of the room they run.
- ADMINISTRATORS act across the whole platform: they can remove content, restrict features, suspend and close accounts. An administrator's decision takes precedence over a host's.
- Automated checks flag some content for human review. A person makes the final decision on any account action.

## How Reports Are Handled
1. You report a room, message, profile, game or piece of content from within the app, or through the Contact page.
2. The report reaches the moderation queue with the surrounding context.
3. A moderator reviews it, checks the relevant records, and decides.
4. Action is taken where the rules were broken, and the queue entry is closed.

We aim to review reports within 24 hours, and sooner for anything involving immediate risk to a person.

## Actions We Take
Action is proportionate and escalates with severity and repetition:

- Removing the content.
- A warning.
- Muting or removing someone from a room.
- Temporarily restricting a feature — chat, voice, media, gifting or games.
- Temporary suspension of the account.
- Permanent closure of the account, and forfeiture of any balance where the closure is for fraud or a serious breach.

Serious matters — particularly anything involving a child, credible threats of violence, or fraud — are escalated immediately and may be referred to law enforcement.

## What Happens to the Person Who Reported
- Reports are treated confidentially. We do not tell the reported person who reported them.
- Retaliation against someone for making a report is itself a breach of these rules.
- Deliberately false or malicious reports are also a breach, and are acted on.

## Appeals
If you believe a decision was wrong, contact us through the Contact page with your username, what happened, and why you think the decision was mistaken. A different reviewer will look at it wherever possible. We will tell you the outcome. We cannot discuss decisions about somebody else's account with you.

## Emergencies
If someone appears to be in immediate danger, contact your local emergency services first. We can act on an account, but we cannot send help to an address. Please also report it to us so we can preserve the relevant records.`,
  },
  {
    // REQUIRED BY GOOGLE PLAY for every app in the Social or Dating category.
    // Play's Child Safety Standards policy asks for PUBLISHED standards that
    // anyone can read without signing in, covering child sexual abuse and
    // exploitation (CSAE) specifically — how it is prohibited, prevented,
    // reported and acted on — plus a named contact point. The Safety &
    // Moderation policy mentions minors in passing, but Play requires a
    // dedicated, findable document, and the Play Console declaration asks for
    // its URL directly.
    slug: "child-safety",
    title: "Child Safety Standards",
    href: "/legal/child-safety",
    section: "legal",
    description: "Lotus Ludo's standards against child sexual abuse and exploitation — our age rules, how we prevent and detect harm to children, how to report it, and who to contact.",
    starter: `Lotus Ludo is an adult platform. We have no tolerance for the sexual abuse or exploitation of children, and we act on it immediately and without exception.

This page sets out our standards, as required by the Google Play Child Safety Standards policy. It applies everywhere Lotus Ludo operates.

## Lotus Ludo Is For Adults
- You must be **18 or over** to hold an account.
- We ask Google Play to prevent users it identifies as minors from downloading the app or making purchases.
- If we find that an account holder is under 18, we close the account and remove their content.

## What Is Absolutely Prohibited
The following result in **immediate, permanent account closure** and a report to the relevant authorities:

- Child sexual abuse material (CSAM) of any kind, in any form — image, video, audio, drawing, animation or text.
- Sexualising a child in any way, including in chat, voice, profile details, room names or usernames.
- Grooming — building a relationship with a child in order to abuse or exploit them.
- Sextortion, or any threat made to obtain sexual content from a child.
- Trafficking a child, or advertising a child for sexual purposes.
- Seeking, offering or linking to any of the above, on our platform or anywhere else.

There is no warning, no strike system and no appeal on the merits for these. The account is closed.

## How We Prevent It
- **Adults only.** Registration is reviewed by an administrator before an account becomes active, and the app is rated and distributed for adults.
- **Reporting built into the app.** Every profile, room, message and piece of content can be reported from inside the app, in a few taps.
- **Moderation.** Hosts and co-hosts moderate their own rooms; administrators act across the whole platform and can remove content, close accounts and preserve records.
- **Records.** Reports, moderation actions and the surrounding context are retained so an incident can be investigated properly and handed to authorities intact.

## How To Report A Child Safety Concern
**If a child is in immediate danger, contact your local emergency services first.** We can close an account; we cannot send help to an address.

Then tell us, by whichever route is quickest for you:

1. **In the app** — use the Report option on the profile, room, message or content.
2. **By email** — write to our child safety contact below.
3. **Through the Contact page** on this website.

Please include the username or User ID, the room or conversation, and roughly when it happened. You do not need to collect or keep any evidence yourself, and you should never forward the material itself.

## What We Do When You Report
1. Reports involving a child are treated as the highest priority and are escalated ahead of everything else in the queue.
2. We act on the account immediately — usually suspension within hours, while the review is carried out.
3. We preserve the account records and the reported content for the authorities.
4. Where the law requires it, or where we judge a child to be at risk, we report to the relevant national authority and to the National Center for Missing & Exploited Children (NCMEC) or the equivalent body in the user's country.
5. We do not tell the reported person who reported them.

## Working With Authorities
We comply with lawful requests from law enforcement and child protection agencies, and we cooperate with them proactively where a child appears to be at risk. We keep the records needed to support an investigation.

## Our Child Safety Contact
We maintain a designated point of contact for child safety matters, able to answer questions about how we prevent and act on child sexual abuse material.

- **Regulators, law enforcement and child protection organisations** — the designated contact address is registered with Google Play for this app, and we respond to enquiries sent through it.
- **Everyone else** — use the Report option inside the app, or write to us through the **Contact** page on this website.

We aim to acknowledge child safety reports within **24 hours**, and we treat them ahead of everything else in the queue.

## Related Policies
- **Community Guidelines** — the full rules of the platform.
- **Safety & Moderation Policy** — how moderation works generally.
- **User Reporting Policy** — how to report anything else.

## Review
These standards are reviewed at least once a year, and whenever the law or our platform changes in a way that affects them.`,
  },
  {
    // REQUIRED BY GOOGLE PLAY. Play will not approve an app that has accounts
    // unless there is a page ANYONE can read — without signing in — explaining
    // how to delete an account and what happens to the data. The in-app route
    // (Profile → Security & Account) already exists; this is the public
    // explanation Google asks for, and the URL given on the Play listing.
    slug: "delete-account",
    title: "Delete Your Account",
    href: "/legal/delete-account",
    section: "legal",
    description: "How to permanently delete your Lotus Ludo account and everything on it — in the app, or by asking us if you cannot sign in.",
    starter: `You can delete your Lotus Ludo account at any time. You do not need to ask permission and you do not need to give a reason.

## Delete It Yourself, In The App
This is the fastest way and takes about a minute.

1. Open Lotus Ludo and sign in.
2. Go to **Profile**.
3. Tap **Security & Account**.
4. Scroll to **Delete account**.
5. Enter your password and type **DELETE** to confirm.

Your account is closed straight away and you are signed out on every device.

## If You Cannot Sign In
If you have lost access to your account, write to us from the email address or mobile number on the account, using the Contact page. Tell us:

- your username or User ID, and
- that you want your account deleted.

We will confirm it is really you, delete the account, and reply to confirm. We aim to do this within **7 days** and always within **30 days**.

## What Is Deleted
When your account is deleted we remove:

- your profile — name, photo, cover picture, bio and personal details;
- your login details and password;
- your messages and your chat history;
- your rooms, your membership of other rooms, and your friends and followers;
- your photos, videos and reels;
- your game history and statistics;
- any identity documents you uploaded for verification.

## What Is Kept, And Why
A small amount of information has to be kept even after deletion, because the law requires it or because it belongs to somebody else:

- **Records of money** — coin purchases, payments and refunds. Tax and accounting law requires these to be kept, normally for up to **7 years**. They are kept as financial records only and are no longer linked to your profile.
- **Safety records** — if your account was reported, suspended or removed for breaking the rules, we keep a minimal record so the same person cannot simply return under a new account. This is kept for up to **2 years**.
- **Other people's content** — messages you sent to another person stay in THEIR copy of the conversation, in the same way an email you sent stays in the recipient's inbox. Your name is removed from them.

## Your Coins And Balance
Deleting your account **ends any coin balance, gifts and rewards you are holding**. Virtual coins have no cash value and cannot be exchanged for money, so nothing is paid out. If you have earnings that are eligible to be withdrawn, request that withdrawal **before** you delete your account.

## This Cannot Be Undone
Once an account is deleted you cannot sign back in, and your username may become available to somebody else. If you only want a break, consider simply logging out instead.

## Questions
If anything here is unclear, ask us through the Contact page before you delete anything. We would rather answer a question than have you lose something you wanted to keep.`,
  },
  {
    slug: "reporting",
    title: "User Reporting Policy",
    href: "/legal/reporting",
    section: "legal",
    description: "How to report a user, message, room or piece of content on Lotus Ludo — what to include, what happens next, and how long it takes.",
    starter: `If someone breaks the rules, reporting them is the fastest way to get it dealt with. This page explains how to report, what happens afterwards, and what to expect.

## What You Can Report
You can report any of the following:

- A user's account or profile.
- A message in a group chat or a direct message.
- A voice room, or something said in one.
- A game or a player's conduct in it.
- A reel, video, image or any other uploaded content.
- A comment.

## How to Report
- IN THE APP: use the report option on the room, message, profile or content itself. This is the fastest route, because it sends us the surrounding context automatically.
- BY EMAIL OR FORM: use our Contact page if you cannot sign in, or if the matter is sensitive.
- For anything urgent involving risk to a person, say so clearly at the start of your report so it is prioritised.

## What to Include
The more of this you can give us, the faster we can act:

- The USERNAME or USER ID of the account involved.
- WHEN it happened — the date and, if you can, the time.
- WHERE it happened — the room name, the chat, the game, or a link to the content.
- WHAT happened, in your own words.
- A SCREENSHOT or recording if you have one.

Please do not edit or crop evidence in a way that changes its meaning — the full context helps us reach the right decision.

## What Happens Next
1. Your report enters the moderation queue with the context attached.
2. A moderator reviews it against our Community Guidelines and the relevant records.
3. Where the rules were broken, we act — see our Safety & Moderation Policy for the range of actions.
4. The report is closed.

We aim to review reports within 24 hours, and immediately where there is a risk to someone's safety.

## Confidentiality
- Reports are confidential. We do not tell the person you reported who reported them.
- We may not be able to tell you the specific action taken against another account — privacy law applies to them as it does to you — but we will confirm that the report was reviewed.
- Retaliating against someone for reporting is itself a breach of the rules.

## Blocking
Reporting and blocking are different, and you can do both. Blocking stops that person contacting you immediately and needs no justification. Reporting lets our team act across the whole platform, which helps the next person as well.

## False Reports
Reporting something in good faith is always welcome, even if we conclude no rule was broken. Deliberately false or malicious reports — for example, mass-reporting someone you lost a game to — are a breach of the rules and are acted on.

## Legal and Law Enforcement Requests
For requests from law enforcement, or notices about unlawful content, contact our Grievance Officer through the Contact page. We remove unlawful content on becoming aware of it and on receiving a valid legal order.

## If Someone Is in Danger
If you believe someone is at immediate risk of harm, contact your local emergency services first. Then report it to us so we can preserve the records and act on the account.`,
  },
  {
    slug: "how-to-play-ludo",
    title: "How to Play Ludo",
    href: "/guides/how-to-play-ludo",
    section: "guide",
    description: "A complete beginner's guide to playing Ludo on Lotus Ludo: the board, the pieces, how a turn works, and how to win.",
    starter: `Ludo is one of the world's best-loved board games — simple to learn, genuinely tactical, and best played with friends. This guide takes you from never having played to your first win.

## What You Need
Nothing but an account. Ludo runs in your browser and needs no download. You can play with friends, with other players, or inside a voice room so everyone can talk while they play.

## The Board
- The board has FOUR coloured corners — red, green, blue and yellow. Each is a player's yard.
- A cross-shaped TRACK runs around the board and leads to the centre.
- Each colour has its own STARTING SQUARE where tokens enter the track.
- Each colour has a coloured HOME PATH leading into the middle, which only that colour may enter.
- STAR squares along the track are SAFE: a token standing on one cannot be captured.

## The Goal
Each player has four tokens. Move all four all the way around the track and into the centre home before your opponents do. First to get all four home wins.

## Starting a Game
- Open Games and choose Ludo.
- Create a game or join one that is waiting for players.
- Games can be 2 or 4 players. Turn order is decided automatically.
- If you are in a voice room, everyone at the table can talk while you play.

## How a Turn Works
1. When it is your turn, TAP THE DICE to roll a number from 1 to 6.
2. To move a token OUT of your yard onto the board, you need a 6.
3. Tap a token to move it forward by the number you rolled.
4. Rolling a 6 gives you ANOTHER turn.
5. If your token lands exactly on an opponent's token, and that square is not safe, you CAPTURE it — their token goes all the way back to their yard.
6. If you have no legal move, your turn passes.

## Getting a Token Home
- After a full circuit of the track, your token turns into your own coloured home path.
- Only your colour can enter your home path — you are safe there.
- To finish, a token must land EXACTLY on the final home square. If your roll is higher than the number needed, you cannot move that token.

## Simple Strategy to Start With
- OPEN SEVERAL TOKENS. With only one token in play, every roll has one destination. With three, you always have a choice.
- USE THE SAFE SQUARES. If an opponent is within six squares behind you, ending your move on a star protects you.
- COUNT THE DANGER before you step out. An opponent can only reach you from one to six squares back.
- TAKE THE CAPTURES THAT ARE WORTH TAKING. Sending an opponent home undoes all their progress — but do not strand yourself in front of three other players to do it.
- PLAN THE ENDGAME. Work out the exact number each token needs to finish, and protect those numbers.

## Common Beginner Mistakes
- Pushing a single token far ahead and leaving it alone and exposed.
- Ignoring safe squares and stopping one square short of one.
- Spending the bonus roll from a 6 automatically on the same token.
- Watching only your own colour and never seeing the capture coming.

## Etiquette
Ludo is a social game. Say good game, do not rush other players, and keep rooms friendly. People remember who was pleasant to play with — and invite them back.

## Ready to Play
Open Ludo, invite a friend into a voice room, and enjoy it the way it is meant to be played: together.`,
  },
  {
    slug: "ludo-rules",
    title: "Ludo Rules Guide",
    href: "/guides/ludo-rules",
    section: "guide",
    description: "The complete rules of Ludo as played on Lotus Ludo — movement, capturing, safe squares, blocks, the home path and how games end.",
    starter: `This is the full rule set for Ludo as played on Lotus Ludo. If you are new to the game, start with our How to Play Ludo guide; this page is the reference for the exact rules, including the edge cases.

## Players and Equipment
- Ludo is played by 2 or 4 players.
- Each player has FOUR tokens of their colour, starting in their yard.
- One six-sided die, rolled by the player whose turn it is.
- Turn order is fixed for the game and moves clockwise.

## Rolling
- On your turn you roll once.
- Rolling a SIX earns you an additional roll.
- Consecutive sixes: rolling three sixes in a row ends your turn, and the third six is not played. This prevents a single turn continuing indefinitely.
- The result is generated on our server, not on your device.

## Entering the Board
- A token can only leave your yard on a roll of 6.
- The token is placed on your colour's starting square.
- If you roll a 6 and have tokens in the yard, you may choose either to bring one out or to move a token already on the track.

## Movement
- A token moves forward the number of squares shown on the die, following the track clockwise.
- You may only move one token per roll.
- If NO legal move is available for the number rolled, your turn passes.
- Tokens move around the whole track once before turning into their own home path.

## Capturing
- If your token finishes its move on a square occupied by a SINGLE opponent token, that token is captured and returns to its owner's yard.
- A captured token must roll a 6 again to re-enter the board.
- You cannot capture on a SAFE square.
- You cannot capture your own token; two of your own tokens may share a square.
- Capturing does not, by itself, grant an extra roll.

## Safe Squares
- The STAR squares marked on the track are safe.
- Each colour's own STARTING square is safe.
- A token standing on a safe square cannot be captured.
- More than one token may occupy a safe square, including tokens of different colours.

## Blocks
- Two of your own tokens on the same square form a BLOCK.
- An opponent's token cannot pass through or land on a block.
- A block is broken when one of the two tokens moves on.

## The Home Path and Finishing
- After completing the circuit, a token turns into the HOME PATH of its own colour.
- Only tokens of that colour may enter that home path, so tokens there cannot be captured.
- To finish, a token must land EXACTLY on the final home square.
- If the number rolled is greater than the number of squares remaining, that token cannot move and you must move another token — or pass if no legal move exists.

## Winning
- The first player to bring ALL FOUR tokens into the final home square wins.
- In a four-player game, play may continue to decide second, third and fourth place, depending on the game settings.

## Turn Timers and Missed Turns
- Each turn has a time limit. If you do not move in time, the turn is skipped.
- Missing several turns in a row removes you from the game so the other players are not left waiting. Your tokens are removed and play continues.
- We do NOT auto-play moves for an idle player: an automatic move could easily be a bad one, and the game should reflect decisions the player actually made.

## Leaving a Game
- Leaving a game in progress counts as forfeiting it.
- Repeatedly abandoning games, especially in tournaments, is treated as a breach of our Fair Play Policy.

## Disconnections
- A brief disconnection does not end your game; rejoin and you will be returned to your position.
- If you cannot return before your turns run out, the missed-turn rule above applies.

## Variations
Some rooms and tournaments enable optional settings — different numbers of players, whether a capture grants an extra roll, or how many places qualify. Any variation in force is shown on the game screen before the match begins.

## Disputes
Game results, rolls and moves are recorded. If you believe a game ended incorrectly, contact us with the room name, the approximate time and what happened, and we will check the record.`,
  },
  {
    slug: "tournament-rules",
    title: "Tournament Rules",
    href: "/guides/tournament-rules",
    section: "guide",
    description: "The official rules for Lotus Ludo tournaments: entry, brackets, qualification, timing, conduct, prizes and disputes.",
    starter: `These rules apply to every tournament run on Lotus Ludo. By registering for a tournament you agree to them, together with our Terms & Conditions and Fair Play Policy.

## Eligibility
- You must be 18 or over and hold an account in good standing.
- One account per person per tournament. Entering with more than one account is grounds for disqualification and forfeiture of any prize.
- Accounts under suspension or restriction may not enter.

## Registration
- Find an upcoming tournament and request to join before registration closes.
- The host reviews requests. Only APPROVED players take part.
- Where joining a tournament costs coins, those coins are HELD when you register, not spent. If the tournament is cancelled, or your entry is not approved, the hold is released and the coins returned.
- Registration closes at the time shown. Late entries cannot be accepted once the bracket is generated.

## Format and Brackets
- When the tournament begins, MATCH ROOMS are created automatically and players are assigned to them.
- Depending on the format, a room holds 2 or 4 players and requires a set number of players to QUALIFY from it.
- A room runs until the required number of players qualify. The remaining players are eliminated.
- The next round is generated automatically from the qualified players, and this continues until one player remains.
- The exact format, room size, number of rounds and qualification count are shown on the tournament page before you register.

## Being Ready to Play
- You must be present when your match room opens. Check the tournament page for your round time.
- A player who does not join their match room within the joining window forfeits that match.
- We strongly recommend joining a few minutes early and checking your connection.

## Timing and Missed Turns
- Standard game timers apply. Missing several turns in a row removes you from the match.
- A player removed for inactivity is eliminated from the tournament.

## Disconnections
- Reconnect and rejoin as quickly as you can; you will be returned to your position.
- If you cannot return before your turns run out, the missed-turn rule applies. We cannot restart or replay a match because of one player's connection.

## Conduct
The following result in disqualification and, where relevant, forfeiture of prizes:

- Collusion between players, including deliberately losing to advance another player.
- Using more than one account.
- Account sharing or having someone else play for you.
- Any modified app, script or bot.
- Deliberate stalling, or abandoning matches to manipulate a bracket.
- Harassment of other entrants, before, during or after a match.

## Fairness of Play
All tournament matches use PURE server-side randomness with no adjustment of any kind. Nothing on any player's device can influence a roll. See our Fair Play Policy.

## Prizes
- Prizes and the places they are awarded to are shown on the tournament page before you register.
- Prizes are credited to the winners' wallets after the tournament is confirmed complete.
- Rewards are awarded in virtual coins. Virtual coins have no cash value and cannot be exchanged for real money.
- A player disqualified for breaking these rules forfeits any prize, which may be reallocated to the next eligible place.

## Cancellation and Changes
- We may cancel or reschedule a tournament — for example if too few players register, or because of a technical fault. Any coins held for joining are returned in full if a tournament is cancelled.
- If a tournament must be restarted because of a platform fault, we will restart it from the last completed round wherever possible.

## Disputes
- Raise a dispute within 48 HOURS of the match in question, through the Contact page.
- Include the tournament name, the round, the match room, the time and what happened, with a screenshot or recording if you have one.
- Game records are checked before any decision. Decisions on tournament results are final once the review is complete.

## Questions
If anything about a tournament's format is unclear, ask BEFORE you register — the host or our support team will explain it.`,
  },
];

/** Docs rendered by the shared [slug] routes (everything without its own page file). */
export const sharedLegalDocs = (section: "legal" | "guide") =>
  LEGAL_DOCS.filter((d) => d.section === section && !d.builtIn);

export const legalDocBySlug = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);
