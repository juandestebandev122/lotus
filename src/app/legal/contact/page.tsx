import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { ContactForm } from "@/components/legal/ContactForm";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";

export const metadata: Metadata = {
  title: "Contact Us · Lotus Ludo",
  description:
    "Contact the Lotus Ludo team — support email, contact form, expected response times, complaint handling and privacy requests.",
  alternates: { canonical: "https://lotusplay.tech/legal/contact" },
};

// Always render fresh so an edit in the admin panel shows up immediately.
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  // Real-world business details come from Admin → Site Content → Contact, so the
  // registered name, address and grievance officer can be corrected without a
  // code change. (They must be genuine: the IT Rules 2021 require a named
  // officer with a working address, and ad networks check them.)
  const c = { ...DEFAULT_SITE_CONTENT.contact, ...((await getConfig()).siteContent?.contact ?? {}) };
  const brand = c.brandName || "Lotus Ludo";
  const support = c.supportEmail || "support@lotusplay.tech";
  const privacy = c.privacyEmail || "privacy@lotusplay.tech";
  const ack = c.ackHours ?? 24;
  const resolve = c.resolveDays ?? 15;

  return (
    <LegalDoc slug="contact">
      <h1>Contact Us</h1>
      <p className="text-mist-500">Last updated: 26 August 2026</p>

      <p>
        We are here to help. Use the form below and it reaches our support team directly — you do not
        need an account to send it, so it works even if you cannot sign in. You can also email us
        using the addresses further down the page.
      </p>

      <h2>Send Us a Message</h2>
      <ContactForm />

      <h2>Email Us</h2>
      <ul>
        <li><strong>General support:</strong> <a href={`mailto:${support}`}>{support}</a></li>
        <li><strong>Privacy &amp; data requests:</strong> <a href={`mailto:${privacy}`}>{privacy}</a></li>
        {c.grievanceEmail && (
          <li><strong>Complaints &amp; grievances:</strong> <a href={`mailto:${c.grievanceEmail}`}>{c.grievanceEmail}</a></li>
        )}
        {c.phone && <li><strong>Phone:</strong> {c.phone}</li>}
        <li><strong>Website:</strong> <a href="https://lotusplay.tech">lotusplay.tech</a></li>
      </ul>

      <h2>Who We Are</h2>
      <ul>
        <li><strong>Brand:</strong> {brand}</li>
        {c.legalName && <li><strong>Operated by:</strong> {c.legalName}</li>}
        {c.address && <li><strong>Registered address:</strong> {c.address}</li>}
        {c.hours && <li><strong>Support hours:</strong> {c.hours}</li>}
      </ul>

      <h2>How Quickly We Reply</h2>
      <ul>
        <li>We acknowledge every enquiry within <strong>{ack} hours</strong> of receiving it.</li>
        <li>We aim to fully resolve enquiries and complaints within <strong>{resolve} days</strong>.</li>
        <li>Reports involving someone&apos;s immediate safety are prioritised and reviewed straight away.</li>
        <li>Replies go to the email address you give us — please check your spam folder if you do not see one.</li>
      </ul>

      <h2>What to Include</h2>
      <p>Giving us these details in your first message usually saves several days:</p>
      <ul>
        <li>Your <strong>username or User ID</strong>.</li>
        <li>For a payment question: the <strong>transaction ID</strong>, amount, date and payment method.</li>
        <li>For a report: the username of the account involved, when and where it happened.</li>
        <li>A screenshot or recording, if you have one.</li>
      </ul>

      <h2>How We Handle Complaints</h2>
      <ol>
        <li><strong>Acknowledgement.</strong> We confirm receipt within {ack} hours and give you a reference.</li>
        <li><strong>Review.</strong> A member of our team investigates, checking the relevant account, payment or game records.</li>
        <li><strong>Resolution.</strong> We reply with our decision and what we have done, normally within {resolve} days. If it will take longer, we tell you why and how long we expect it to take.</li>
        <li><strong>Escalation.</strong> If you are not satisfied, reply and ask for the matter to be escalated{c.grievanceName ? ` to our Grievance Officer, ${c.grievanceName}` : " to our Grievance Officer"}. It will be reviewed by someone who was not involved in the original decision.</li>
      </ol>

      {c.grievanceName || c.grievanceEmail ? (
        <>
          <h2>Grievance Officer</h2>
          <p>
            In accordance with the Information Technology Act, 2000 and the Information Technology
            (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, our Grievance
            Officer can be reached at:
          </p>
          <ul>
            {c.grievanceName && <li><strong>Name:</strong> {c.grievanceName}</li>}
            {c.grievanceEmail && <li><strong>Email:</strong> <a href={`mailto:${c.grievanceEmail}`}>{c.grievanceEmail}</a></li>}
            {c.address && <li><strong>Address:</strong> {c.address}</li>}
          </ul>
        </>
      ) : null}

      <h2>Privacy and Data Requests</h2>
      <p>
        To request a copy of the personal data we hold about you, correct it, or ask us to delete
        your account and data, email <a href={`mailto:${privacy}`}>{privacy}</a> from the address
        registered to your account, or use the form above and choose{" "}
        <strong>&ldquo;Privacy / data request&rdquo;</strong>. Tell us which right you are exercising
        and include your username or User ID.
      </p>
      <p>
        We verify that the request comes from the account holder, acknowledge it within {ack} hours,
        and complete it within <strong>30 days</strong>. Our{" "}
        <a href="/legal/privacy">Privacy Policy</a> explains this in full, including what we must
        keep for legal reasons.
      </p>

      <h2>Reporting a User, Content or Illegal Material</h2>
      <p>
        The fastest way to report something is the <strong>report option inside the app</strong> —
        it sends us the surrounding context automatically. If you cannot sign in, use the form above
        and choose &ldquo;Report a user or content&rdquo;.
      </p>
      <p>
        Our <a href="/legal/reporting">User Reporting Policy</a> explains what to include and what
        happens next, and our <a href="/legal/safety-moderation">Safety &amp; Moderation Policy</a>{" "}
        sets out the actions we take. We remove unlawful content on becoming aware of it and on
        receiving a valid legal order.
      </p>
      <p>
        <strong>If someone is in immediate danger, contact your local emergency services first.</strong>{" "}
        We can act on an account, but we cannot send help to an address.
      </p>

      <h2>Before You Write</h2>
      <p>You may find an answer faster in one of these:</p>
      <ul>
        <li><a href="/faq">Frequently asked questions</a></li>
        <li><a href="/legal/refund">Refund Policy</a> and <a href="/legal/coin-purchase">Coin Purchase Policy</a></li>
        <li><a href="/legal/community">Community Guidelines</a> and <a href="/legal/fair-play">Fair Play Policy</a></li>
        <li><a href="/guides">Player guides</a> — how to play, the full rules, and tournaments</li>
      </ul>
    </LegalDoc>
  );
}
