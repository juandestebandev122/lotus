import { LegalDoc } from "@/components/legal/LegalDoc";

// Always render fresh so an edit in the admin panel shows up immediately.
export const dynamic = "force-dynamic";

export const metadata = { title: "Community Guidelines · LotusPlay Connect" };

export default function CommunityPage() {
  return (
    <LegalDoc slug="community">
      <h1>Community Guidelines</h1>
      <p className="text-mist-500">Last updated: 17 June 2026</p>

      <p>
        LotusPlay Connect is a place to hang out, talk, and play together. To keep it safe and
        welcoming for everyone, all users must follow these Community Guidelines. Breaking them may
        lead to content removal, warnings, suspension, or a permanent ban.
      </p>

      <h2>Be Respectful</h2>
      <ul>
        <li>Treat others with respect. No harassment, bullying, or threats.</li>
        <li>No hate speech or discrimination based on religion, caste, gender, race, ethnicity, disability, or any other protected characteristic.</li>
      </ul>

      <h2>Prohibited Content &amp; Behaviour</h2>
      <p>The following are strictly not allowed:</p>
      <ul>
        <li>Hate speech.</li>
        <li>Threats and harassment.</li>
        <li>Obscene, sexually explicit, or otherwise inappropriate content.</li>
        <li>Terrorist propaganda or content promoting violence or self-harm.</li>
        <li>Impersonation of any person or organisation.</li>
        <li>Promotion of illegal gambling.</li>
        <li>Distribution of illegal content, including content that infringes others&apos; rights.</li>
        <li>Spam, scams, fraud, or attempts to deceive other users.</li>
      </ul>

      <h2>Do Not Post Illegal Content</h2>
      <p>
        You must not post, share, or transmit any content that is unlawful under Indian law. We
        remove unlawful content when we become aware of it and after receiving valid legal orders,
        and we may report serious matters to the authorities.
      </p>

      <h2>Protecting Minors</h2>
      <p>
        The Platform is intended for users aged 18 and above. Content that exploits, endangers, or
        sexualises minors is absolutely prohibited and will be reported to the authorities.
      </p>

      <h2>Reporting &amp; Enforcement</h2>
      <ul>
        <li>Use the in-app report option to flag users or content that break these rules.</li>
        <li>Our moderation team reviews reports and takes appropriate action.</li>
        <li>Repeated or serious violations result in suspension or permanent removal.</li>
      </ul>

      <h2>Grievances</h2>
      <p>
        If you believe action was taken in error, or you wish to raise a concern, contact our
        Grievance Officer via the <a href="/legal/contact">Contact Us</a> page. We acknowledge
        complaints within 24 hours and aim to resolve them within 15 days.
      </p>
    </LegalDoc>
  );
}
