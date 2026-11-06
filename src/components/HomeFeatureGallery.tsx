import { withBase } from "@/lib/base-path";
import { listHomeFeature, type SiteContent } from "@/lib/site-content-default";

/** Every picture and MP4 from Admin → Site Content → SEO & Home. */
export function HomeFeatureGallery({ feature }: { feature?: SiteContent["homeFeature"] }) {
  const items = listHomeFeature(feature);
  if (!items.length) return null;
  const href = feature?.href || "";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const wide = item.kind === "video";
        return (
          <figure
            key={item.id}
            className={`overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-xl shadow-black/30 ${wide ? "sm:col-span-2" : ""}`}
          >
            {item.kind === "video" ? (
              <video src={withBase(item.url)} className="w-full bg-black" controls playsInline muted preload="metadata" />
            ) : href ? (
              <a href={href} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={withBase(item.url)} alt={feature?.alt || item.name || ""} className="w-full" />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={withBase(item.url)} alt={feature?.alt || item.name || ""} className="w-full" />
            )}
          </figure>
        );
      })}
      {feature?.caption && (
        <p className="sm:col-span-2 text-center text-sm text-mist-400">{feature.caption}</p>
      )}
    </div>
  );
}
