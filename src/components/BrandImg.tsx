"use client";

import { useConfig } from "@/lib/config";
import { brandSrc, type BrandSlot } from "@/lib/brand-images";

/** Renders an app image that the admin can change from Admin → App Images.
 *  Falls back to the built-in default asset when no override is set. */
export function BrandImg({
  slot,
  alt = "",
  className,
  style,
  draggable,
}: {
  slot: BrandSlot;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
}) {
  const { config } = useConfig();
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={brandSrc(config.images, slot)} alt={alt} className={className} style={style} draggable={draggable} />;
}
