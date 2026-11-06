import { LegalDoc } from "@/components/legal/LegalDoc";

// Always render fresh so an edit in the admin panel shows up immediately.
export const dynamic = "force-dynamic";

export const metadata = { title: "Refund Policy · LotusPlay Connect" };

export default function RefundPage() {
  return (
    <LegalDoc slug="refund">
      <h1>Refund Policy</h1>
      <p className="text-mist-500">Last updated: 17 June 2026</p>

      <p>
        This Refund Policy explains how refunds work for virtual coins and premium features
        purchased on LotusPlay Connect (lotusplay.tech).
      </p>

      <h2>1. Virtual Coins &amp; Digital Goods</h2>
      <ul>
        <li>Coins and digital items are delivered to your account immediately after a successful payment.</li>
        <li>Because they are delivered instantly and consumed digitally, purchases are generally <strong>non-refundable</strong> once credited, except as required by law or as set out below.</li>
      </ul>

      <h2>2. When You May Be Eligible for a Refund</h2>
      <ul>
        <li><strong>Failed or duplicate transactions:</strong> if money was deducted but coins were not credited, or you were charged more than once for the same purchase.</li>
        <li><strong>Unauthorised transactions:</strong> if a payment was made without your authorisation (subject to verification).</li>
        <li><strong>Technical errors</strong> on our side that prevented you from receiving what you paid for.</li>
      </ul>

      <h2>3. How to Request a Refund</h2>
      <ul>
        <li>Contact us via the <a href="/legal/contact">Contact Us</a> page within 7 days of the transaction.</li>
        <li>Include your account email/username, the transaction ID, the date, and a description of the issue.</li>
      </ul>

      <h2>4. Processing &amp; Timelines</h2>
      <ul>
        <li>We acknowledge refund requests within 24&ndash;48 hours.</li>
        <li>Approved refunds are processed to the original payment method, typically within 5&ndash;10 business days, depending on your bank or payment provider.</li>
      </ul>

      <h2>5. Non-Refundable Situations</h2>
      <ul>
        <li>Coins already spent on gifts, games, or premium features.</li>
        <li>Accounts suspended or terminated for violating our <a href="/legal/terms">Terms &amp; Conditions</a> or <a href="/legal/community">Community Guidelines</a>.</li>
        <li>Change of mind after coins have been credited and used.</li>
      </ul>

      <h2>6. Contact</h2>
      <p>
        For any refund questions, please reach our support and Grievance Officer via the{" "}
        <a href="/legal/contact">Contact Us</a> page.
      </p>
    </LegalDoc>
  );
}
