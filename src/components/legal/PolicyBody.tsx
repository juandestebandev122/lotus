import { withBase } from "@/lib/base-path";

/**
 * Renders an admin-written policy body.
 *
 * Deliberately NOT dangerouslySetInnerHTML — an admin types plain text and it is
 * rendered as plain text, so nothing typed in the panel can inject markup into a
 * reader's browser. A tiny, obvious format covers what these pages need:
 *
 *   ## Heading         → a section heading
 *   - point            → a bullet
 *   [img]<url>[/img]   → a picture
 *   blank line         → a new paragraph
 *
 * Anything else is a paragraph, so an admin who just types normally still gets a
 * sensible page.
 */
export function PolicyBody({ body }: { body: string }) {
  const lines = (body ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let bullets: string[] = [];

  const flushPara = (key: string) => {
    if (!para.length) return;
    out.push(<p key={`p-${key}`}>{para.join(" ")}</p>);
    para = [];
  };
  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    out.push(<ul key={`u-${key}`}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    const key = String(i);

    // Picture on its own line.
    const img = /^\[img\]\s*(\S+?)\s*\[\/img\]$/i.exec(line);
    if (img) {
      flushPara(key); flushBullets(key);
      out.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`i-${key}`} src={withBase(img[1])} alt="" className="my-3 h-auto w-full max-w-lg rounded-xl border border-white/10" />,
      );
      return;
    }
    if (!line) { flushPara(key); flushBullets(key); return; }
    if (line.startsWith("## ")) {
      flushPara(key); flushBullets(key);
      out.push(<h2 key={`h-${key}`}>{line.slice(3).trim()}</h2>);
      return;
    }
    if (line.startsWith("- ")) {
      flushPara(key);
      bullets.push(line.slice(2).trim());
      return;
    }
    flushBullets(key);
    para.push(line);
  });
  flushPara("end"); flushBullets("end");

  return <>{out}</>;
}
