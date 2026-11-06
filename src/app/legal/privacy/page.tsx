import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";

export const metadata: Metadata = {
  title: "Privacy Policy · Lotus Ludo",
  description:
    "How Lotus Ludo collects, uses, shares and protects your personal information — including cookies, advertising, analytics, payments, retention and your rights.",
  alternates: { canonical: "https://lotusplay.tech/legal/privacy" },
};

// Always render fresh so an edit in the admin panel shows up immediately.
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const c = { ...DEFAULT_SITE_CONTENT.contact, ...((await getConfig()).siteContent?.contact ?? {}) };
  const brand = c.brandName || "Lotus Ludo";
  const privacyEmail = c.privacyEmail || "privacy@lotusplay.tech";
  const supportEmail = c.supportEmail || "support@lotusplay.tech";

  return (
    <LegalDoc slug="privacy">
      <h1>Privacy Policy</h1>
      <p className="text-mist-500">Last updated: 26 August 2026</p>

      <p>
        This Privacy Policy explains what personal information {brand} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, the &ldquo;Platform&rdquo;) collects when you use lotusplay.tech and our
        app, why we collect it, who we share it with, how long we keep it, and the choices and
        rights you have. Please read it alongside our{" "}
        <a href="/legal/terms">Terms &amp; Conditions</a>.
      </p>
      <p>
        {brand} is intended for users aged <strong>18 and over</strong>. We do not knowingly collect
        personal information from children. If you believe a child has given us information, contact
        us at <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a> and we will delete it.
      </p>

      <h2>1. Information You Give Us</h2>
      <ul>
        <li>
          <strong>Account information</strong> — your name or display name, username, email address
          and/or mobile number, password (stored only as a secure one-way hash, never in readable
          form), date of birth or age confirmation, and your country.
        </li>
        <li>
          <strong>Profile information</strong> — your profile picture, cover image, bio, gender if
          you choose to give it, and any other details you add to your profile. Anything you put on
          your profile is visible to other users.
        </li>
        <li>
          <strong>Content you create</strong> — chat messages, direct messages, reels and videos,
          images, comments, room names and descriptions, and audio you transmit in a live voice room.
        </li>
        <li>
          <strong>Identity documents</strong> — where you take part in verification (KYC), withdrawals
          or agency programmes, the documents and details you submit for that purpose.
        </li>
        <li>
          <strong>Support correspondence</strong> — the messages, screenshots and contact details you
          send us through the contact form, support tickets or email.
        </li>
      </ul>

      <h2>2. Information We Collect Automatically</h2>
      <ul>
        <li>
          <strong>IP address.</strong> We collect and store the IP address your device connects from.
          We use it for security (detecting unauthorised access, abuse and multiple-account fraud),
          for approximate country-level location, and to comply with legal obligations. An IP address
          is treated as personal information under laws such as the GDPR.
        </li>
        <li>
          <strong>Device and browser information</strong> — device type, model, operating system and
          version, browser type and version, screen size, language, time zone, and a device
          identifier we generate to recognise the same device across sessions.
        </li>
        <li>
          <strong>Usage information</strong> — pages and screens you open, rooms you join, games you
          play and their results, features you use, buttons you tap, session start and end times, and
          referring pages.
        </li>
        <li>
          <strong>Log data</strong> — dates and times of requests, error reports, and the actions
          taken on your account by you or by our moderators.
        </li>
        <li>
          <strong>Approximate location</strong> — derived from your IP address at country/region
          level. We do not collect precise GPS location.
        </li>
      </ul>

      <h2>3. Cookies and Similar Technologies</h2>
      <p>
        We and our partners use cookies and similar technologies (local storage, session storage and
        similar browser storage) to run the Platform and to understand how it is used.
      </p>
      <ul>
        <li>
          <strong>Strictly necessary cookies.</strong> These keep you signed in, keep your session
          secure, remember your consent choices and protect against fraud. The Platform cannot work
          without them, so they cannot be switched off.
        </li>
        <li>
          <strong>Preference storage.</strong> Remembers settings such as your chosen theme, audio
          devices and interface options.
        </li>
        <li>
          <strong>Analytics cookies.</strong> Help us understand which pages are visited and where
          problems occur, so we can improve the Platform.
        </li>
        <li>
          <strong>Advertising cookies.</strong> Set by advertising partners to select and measure
          advertisements — see section 4.
        </li>
      </ul>
      <p>
        <strong>Your choices.</strong> Most browsers let you see the cookies a site has set, delete
        them, and block some or all of them — usually under Settings → Privacy. Blocking strictly
        necessary cookies will stop you being able to sign in. You can opt out of personalised
        advertising as described in section 4.
      </p>

      <h2>4. Advertising, Google AdSense and Third-Party Cookies</h2>
      <p>
        We may display advertisements on parts of the Platform, including advertisements served by{" "}
        <strong>Google AdSense</strong>. You should know the following:
      </p>
      <ul>
        <li>
          Third-party vendors, <strong>including Google</strong>, use cookies to serve
          advertisements based on your prior visits to this website and other websites.
        </li>
        <li>
          Google&apos;s use of advertising cookies enables it and its partners to serve
          advertisements to you based on your visit to our site and/or other sites on the internet.
        </li>
        <li>
          You may opt out of personalised advertising by visiting{" "}
          <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer noopener">
            Google Ads Settings
          </a>.
        </li>
        <li>
          You can opt out of a third-party vendor&apos;s use of cookies for personalised advertising
          at{" "}
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer noopener">
            aboutads.info/choices
          </a>{" "}
          or{" "}
          <a href="https://optout.networkadvertising.org/" target="_blank" rel="noreferrer noopener">
            optout.networkadvertising.org
          </a>.
        </li>
        <li>
          Third-party advertisers may also place cookies or web beacons themselves. We do not control
          these and this Privacy Policy does not cover them — please read the privacy policy of the
          advertiser concerned. Google&apos;s is at{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer noopener">
            policies.google.com/technologies/partner-sites
          </a>.
        </li>
      </ul>

      <h2>5. Analytics</h2>
      <p>
        We may use <strong>Google Analytics</strong>, a web analytics service provided by Google LLC,
        to understand how the Platform is used. Google Analytics uses cookies and similar identifiers
        to collect information such as the pages you visit, how long you spend on them, your
        approximate location, and your device and browser type. This information is transmitted to
        and stored by Google.
      </p>
      <p>
        We use it in aggregate to improve the Platform — not to identify you personally. You can
        prevent Google Analytics from collecting your data by installing the{" "}
        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer noopener">
          Google Analytics Opt-out Browser Add-on
        </a>. Google&apos;s privacy policy is at{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer noopener">
          policies.google.com/privacy
        </a>.
      </p>

      <h2>6. Payment Information</h2>
      <ul>
        <li>
          Payments for virtual coins and other purchases are processed by{" "}
          <strong>third-party payment providers</strong>. Depending on your country and the method
          you choose, this may include Stripe, a UPI provider, or another regulated processor shown
          at checkout.
        </li>
        <li>
          <strong>We do not receive or store your full card number, CVV or banking credentials.</strong>{" "}
          Those go directly to the payment provider, who is responsible for handling them securely.
        </li>
        <li>
          We do store a record of the <strong>transaction</strong> — the amount, currency, date and
          time, what was purchased, the transaction reference, whether it succeeded or failed, and
          the last four digits or masked identifier the provider returns to us. We need this to
          credit your account, answer payment questions, process refunds, prevent fraud and meet our
          tax and accounting obligations.
        </li>
        <li>
          Where you request a withdrawal or take part in a payout programme, we collect the payment
          details necessary to pay you, and any identity information required by law.
        </li>
        <li>
          Payment providers process your information under their own privacy policies. Please read
          the policy of the provider shown at checkout.
        </li>
      </ul>

      <h2>7. How We Use Your Information</h2>
      <ul>
        <li>To create and operate your account and provide the Platform&apos;s features.</li>
        <li>To run games, voice rooms, tournaments, gifting, levels and rewards.</li>
        <li>To process purchases, credit coins, handle refunds and pay out withdrawals.</li>
        <li>To keep the Platform safe — detecting fraud, cheating, multiple accounts, abuse and unauthorised access.</li>
        <li>To moderate content and enforce our Community Guidelines and Terms.</li>
        <li>To answer your support enquiries and complaints.</li>
        <li>To send service messages about your account, security or important changes.</li>
        <li>To understand how the Platform is used and improve it.</li>
        <li>To display and measure advertising.</li>
        <li>To comply with legal obligations and respond to lawful requests.</li>
      </ul>
      <p>
        Where the law requires a legal basis (for example under the GDPR), we rely on: performance of
        our contract with you (to provide the service); our legitimate interests (security, fraud
        prevention, improving the Platform); your consent (for non-essential cookies and marketing,
        which you can withdraw at any time); and compliance with a legal obligation.
      </p>

      <h2>8. Who We Share Information With</h2>
      <p>
        We do not sell your personal information. We share it only as described here:
      </p>
      <ul>
        <li><strong>Other users</strong> — your display name, profile picture, level, badges, and anything you post publicly or say in a room is visible to others.</li>
        <li><strong>Payment providers</strong> — to take payment and process refunds and withdrawals.</li>
        <li><strong>Hosting and infrastructure providers</strong> — the servers on which the Platform runs, and our real-time voice infrastructure.</li>
        <li><strong>Analytics providers</strong> — such as Google Analytics, as described above.</li>
        <li><strong>Advertising partners</strong> — such as Google AdSense, as described above.</li>
        <li><strong>Communication providers</strong> — for sending one-time codes and service emails.</li>
        <li><strong>Professional advisers</strong> — lawyers, accountants and auditors, where necessary.</li>
        <li><strong>Law enforcement and regulators</strong> — where we are legally required to, or where it is necessary to protect someone&apos;s safety, our rights, or to investigate fraud or serious abuse.</li>
        <li><strong>A successor</strong> — if our business is reorganised, merged or acquired, your information may transfer to the new owner, who will remain bound by this policy.</li>
      </ul>
      <p>
        Some of these providers are located outside your country. Where information is transferred
        internationally, we take steps to ensure it remains protected to the standard required by
        applicable law.
      </p>

      <h2>9. How Long We Keep Your Information (Retention)</h2>
      <p>
        We keep personal information only as long as we need it for the purposes above, or as long as
        the law requires. In practice:
      </p>
      <ul>
        <li><strong>Account information</strong> — for as long as your account is open, and up to <strong>90 days</strong> after you close it (so it can be restored if you change your mind or the closure was not genuine).</li>
        <li><strong>Content you posted</strong> — deleted with your account, except where it forms part of another user&apos;s conversation or an ongoing moderation or legal matter.</li>
        <li><strong>Transaction and payment records</strong> — retained for up to <strong>7 years</strong> after the transaction, because tax and accounting law requires it.</li>
        <li><strong>Server and security logs, including IP addresses</strong> — normally <strong>12 months</strong>, longer where needed for an ongoing investigation.</li>
        <li><strong>Moderation records, reports and enforcement decisions</strong> — up to <strong>3 years</strong>, so repeat behaviour can be recognised and bans can be enforced.</li>
        <li><strong>Identity/KYC documents</strong> — for the period required by the applicable financial regulations, and deleted afterwards.</li>
        <li><strong>Support correspondence</strong> — up to <strong>3 years</strong>.</li>
        <li><strong>Analytics data</strong> — retained in aggregated or de-identified form, from which you cannot be identified.</li>
      </ul>
      <p>
        Where we are required to retain something after you have asked for deletion — for example a
        financial record, or a record of a ban to prevent evasion — we keep only what is necessary
        and stop using it for any other purpose.
      </p>

      <h2>10. Deleting Your Account and Your Data</h2>
      <p>You can ask us to delete your account and personal information at any time. There are two ways:</p>
      <ul>
        <li><strong>In the app</strong> — open Settings and choose the account deletion option, if available on your account type.</li>
        <li><strong>By contacting us</strong> — email <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a> from the address registered to your account, or use our <a href="/legal/contact">Contact page</a> and choose &ldquo;Privacy / data request&rdquo;.</li>
      </ul>
      <p>What happens next:</p>
      <ul>
        <li>We verify that the request genuinely comes from the account holder. This protects you from someone else deleting your account.</li>
        <li>We confirm the request within <strong>{c.ackHours ?? 24} hours</strong> and complete it within <strong>30 days</strong>.</li>
        <li>Your profile, content and personal details are deleted or irreversibly anonymised.</li>
        <li>Records we must keep by law — principally financial records — are retained for the periods in section 9 and used for nothing else.</li>
        <li><strong>Any unused coins or balance are forfeited</strong> and cannot be restored. Please use or withdraw anything you are entitled to before requesting deletion.</li>
      </ul>

      <h2>11. Your Rights and How to Exercise Them</h2>
      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of the personal information we hold about you.</li>
        <li><strong>Rectification</strong> — have inaccurate information corrected. Most profile details you can edit yourself.</li>
        <li><strong>Erasure</strong> — have your information deleted, subject to section 10.</li>
        <li><strong>Restriction</strong> — ask us to limit how we use your information while a query is resolved.</li>
        <li><strong>Portability</strong> — receive your information in a machine-readable format.</li>
        <li><strong>Object</strong> — object to processing based on our legitimate interests, and to direct marketing at any time.</li>
        <li><strong>Withdraw consent</strong> — where we rely on consent, withdraw it at any time. This does not affect what we did before you withdrew it.</li>
        <li><strong>Complain</strong> — lodge a complaint with your local data protection authority.</li>
      </ul>
      <p>
        <strong>To make a request:</strong> email <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>{" "}
        or use the <a href="/legal/contact">Contact page</a> and select &ldquo;Privacy / data
        request&rdquo;. Tell us which right you are exercising and include your username or User ID.
        We will ask you to verify your identity, acknowledge within{" "}
        <strong>{c.ackHours ?? 24} hours</strong>, and respond within <strong>30 days</strong>.
        Exercising your rights is free; we may charge a reasonable fee only for requests that are
        clearly excessive or repetitive.
      </p>

      <h2>12. Security</h2>
      <ul>
        <li>Traffic between your device and our servers is encrypted in transit (HTTPS/TLS).</li>
        <li>Passwords are stored as one-way hashes and are never readable by us or by anyone else.</li>
        <li>Access to personal information is limited to staff who need it, and administrator actions are logged.</li>
        <li>We monitor for unauthorised access, unusual sign-ins and multiple-account abuse.</li>
      </ul>
      <p>
        No system is perfectly secure. Please help by using a password you do not use anywhere else,
        never sharing your login, and telling us immediately at{" "}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a> if you think your account has been
        accessed by someone else. If a breach occurs that is likely to put your rights at risk, we
        will notify you and the relevant authority as the law requires.
      </p>

      <h2>13. Live Voice Rooms</h2>
      <p>
        Audio in a live voice room is transmitted in real time so other people in that room can hear
        you. Please treat anything you say in a room as public to that room. Where a room is recorded,
        this is indicated on screen before you speak. Recordings made for moderation purposes are
        retained only as long as needed to deal with the matter.
      </p>

      <h2>14. Links to Other Sites</h2>
      <p>
        The Platform may link to third-party websites or show third-party advertisements. We are not
        responsible for their content or their privacy practices. Please read the privacy policy of
        any site you visit.
      </p>

      <h2>15. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date at
        the top shows when it last changed. If we make a significant change we will tell you through
        the Platform or by email before it takes effect. Continuing to use the Platform after a change
        means you accept the updated policy.
      </p>

      <h2>16. How to Contact Us</h2>
      <ul>
        <li><strong>Privacy and data requests:</strong> <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a></li>
        <li><strong>General support:</strong> <a href={`mailto:${supportEmail}`}>{supportEmail}</a></li>
        {c.grievanceName && <li><strong>Grievance Officer:</strong> {c.grievanceName}{c.grievanceEmail ? <> — <a href={`mailto:${c.grievanceEmail}`}>{c.grievanceEmail}</a></> : null}</li>}
        {c.legalName && <li><strong>Operated by:</strong> {c.legalName}</li>}
        {c.address && <li><strong>Address:</strong> {c.address}</li>}
        <li><strong>Contact form:</strong> <a href="/legal/contact">lotusplay.tech/legal/contact</a></li>
      </ul>
    </LegalDoc>
  );
}
