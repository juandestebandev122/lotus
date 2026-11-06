import { getConfig } from "@/server/repo";

/**
 * Search-engine ownership verification tags.
 *
 * Google Search Console and Bing Webmaster Tools both accept a <meta> tag in the
 * page <head> as proof you own the site. Putting the code in the admin panel
 * (Admin → Site Content → SEO) means the client can verify the site themselves
 * without a code change or a deploy — they paste the code, save, and press
 * Verify.
 *
 * React 19 hoists <meta> into <head> from anywhere in the tree, so this can be a
 * small server component rather than forcing the root layout to become dynamic.
 * Renders nothing at all until a code has been entered.
 */
export async function SeoVerification() {
  const seo = (await getConfig()).siteContent?.seo;
  const google = (seo?.googleVerification ?? "").trim();
  const bing = (seo?.bingVerification ?? "").trim();
  if (!google && !bing) return null;
  return (
    <>
      {google && <meta name="google-site-verification" content={google} />}
      {bing && <meta name="msvalidate.01" content={bing} />}
    </>
  );
}
