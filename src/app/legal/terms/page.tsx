import { LegalDoc } from "@/components/legal/LegalDoc";

// Always render fresh so an edit in the admin panel shows up immediately.
export const dynamic = "force-dynamic";

export const metadata = { title: "Terms & Conditions · LotusPlay Connect" };

export default function TermsPage() {
  return (
    <LegalDoc slug="terms">
      <h1>Terms &amp; Conditions</h1>
      <p className="text-mist-500">Last updated: 17 June 2026</p>

      <p>
        These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the
        LotusPlay Connect platform, including the website at lotusplay.tech and any related
        applications (the &ldquo;Platform&rdquo;), operated by LotusPlay Connect (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, &ldquo;our&rdquo;). By creating an account or using the Platform, you
        agree to these Terms. If you do not agree, please do not use the Platform.
      </p>

      <h2>1. Eligibility</h2>
      <ul>
        <li>You must be at least 18 years old to create an account and make payments.</li>
        <li>Users under 18 may only use the Platform with the consent and supervision of a parent or legal guardian.</li>
        <li>You must provide accurate registration information and keep it up to date.</li>
        <li>One person may not maintain multiple accounts to abuse features, rewards, or other users.</li>
      </ul>

      <h2>2. User Responsibilities</h2>
      <ul>
        <li>You are responsible for all activity on your account and for keeping your login secure.</li>
        <li>You agree to use the Platform lawfully and to respect other users.</li>
        <li>You will not upload, share, or transmit any illegal, harmful, or infringing content.</li>
        <li>You will comply with these Terms, our <a href="/legal/community">Community Guidelines</a>, and applicable Indian law.</li>
      </ul>

      <h2>3. Prohibited Activities</h2>
      <p>You must not engage in, promote, or facilitate any of the following:</p>
      <ul>
        <li>Hate speech, threats, harassment, bullying, or abuse.</li>
        <li>Obscene, sexually explicit, or otherwise inappropriate content.</li>
        <li>Terrorist propaganda or content that promotes violence.</li>
        <li>Impersonation of any person or entity.</li>
        <li>Promotion of illegal gambling or other unlawful activities.</li>
        <li>Distribution of illegal content, malware, or spam.</li>
        <li>Fraud, cheating, exploitation of bugs, or manipulation of in-app currency.</li>
      </ul>

      <h2>4. Virtual Coins &amp; Payments</h2>
      <ul>
        <li>The Platform offers virtual &ldquo;coins&rdquo; that can be purchased and used for gifts and premium features.</li>
        <li>Coins have no real-world monetary value outside the Platform and are not legal tender.</li>
        <li>Payments are processed by third-party payment gateways. Applicable taxes may apply.</li>
        <li>Social Gifts and Withdrawals (where offered) are subject to verification, minimum thresholds, and review. </li>
        <li>See our <a href="/legal/refund">Refund Policy</a> for details on refunds.</li>
      </ul>

      <h2>5. Suspension &amp; Termination</h2>
      <ul>
        <li>We may suspend, restrict, or terminate your account if you violate these Terms or the law, or to protect the Platform and its users.</li>
        <li>You may stop using the Platform and request account deletion at any time.</li>
        <li>On termination, unused coins may be forfeited to the extent permitted by law.</li>
      </ul>

      <h2>6. Intellectual Property</h2>
      <p>
        The Platform, including its name, logo, design, software, and content (excluding
        user-generated content), is owned by us and protected by intellectual-property laws. You
        may not copy, modify, or distribute it without our written permission. You retain rights
        to content you create, but grant us a licence to host and display it for the operation of
        the Platform.
      </p>

      <h2>7. Disclaimers &amp; Limitation of Liability</h2>
      <p>
        The Platform is provided &ldquo;as is&rdquo; without warranties of any kind. To the
        maximum extent permitted by law, we are not liable for indirect or consequential damages
        arising from your use of the Platform.
      </p>

      <h2>8. Grievance Redressal</h2>
      <p>
        In accordance with the Information Technology Act, 2000 and the Information Technology
        (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, complaints may be
        sent to our Grievance Officer. We will acknowledge complaints within 24 hours and resolve
        them within 15 days. See <a href="/legal/contact">Contact Us</a> for details.
      </p>

      <h2>9. Governing Law &amp; Dispute Resolution</h2>
      <p>
        These Terms are governed by the laws of India. Any disputes shall be subject to the
        exclusive jurisdiction of the courts of India. We encourage you to first contact our
        Grievance Officer to resolve any concerns.
      </p>

      <h2>10. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be notified on the
        Platform. Continued use after changes constitutes acceptance.
      </p>
    </LegalDoc>
  );
}
