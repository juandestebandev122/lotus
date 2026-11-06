# Brand images

Drop your provided artwork here to use it across the site. Suggested filenames
(the code already renders a built-in SVG lotus logo, so these are optional
enhancements):

- `logo.png`            — LotusPlay Connect app logo (from your splash mockup)
- `lotus.png`           — pink lotus flower artwork
- `lotus-ludo.png`      — "Lotus Ludo" game tile
- `hero.png`            — marketing hero image
- `og-image.png`        — 1200×630 social share image

After adding a file, reference it as `/images/<filename>` in any component, e.g.

```tsx
import Image from "next/image";
<Image src="/images/logo.png" alt="LotusPlay Connect" width={160} height={48} />
```
