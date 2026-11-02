/**
 * Draws a laid-out DOM subtree into a canvas through an SVG <foreignObject>, for
 * browsers without HTML-in-Canvas. The SVG can't load anything itself, so the
 * page's rules, fonts and images are all inlined into it.
 */
const toDataUrl = async (url: string) => {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
};

const VARS = ["--font-serif", "--font-geist-sans", "--font-geist-mono"];
let shared: Promise<string> | null = null;

/** The sheet's CSS rules plus its web fonts as data URLs. */
function collectCss() {
  shared ??= (async () => {
    const rules: string[] = [];
    const faces: Promise<string>[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let list: CSSRuleList;
      try {
        list = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet
      }
      for (const rule of Array.from(list)) {
        if (rule instanceof CSSFontFaceRule) {
          const range = rule.style.getPropertyValue("unicode-range");
          // Latin subsets only; the sheet has no other script to draw.
          if (range && !/U\+0{1,4}(-|,|\s|$)/i.test(range)) continue;
          const base = sheet.href ?? location.href;
          faces.push(
            (async () => {
              let css = rule.cssText;
              for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
                if (m[1].startsWith("data:")) continue;
                css = css.replace(m[0], `url("${await toDataUrl(new URL(m[1], base).href)}")`);
              }
              return css;
            })().catch(() => ""),
          );
        } else if (/\.sx-|\.sheet/.test(rule.cssText) && !(rule instanceof CSSKeyframesRule)) {
          rules.push(rule.cssText);
        }
      }
    }
    return [...(await Promise.all(faces)), ...rules].join("\n");
  })();
  return shared;
}

function svgFor(host: HTMLElement, css: string, width: number, height: number, vars: string) {
  const clone = host.cloneNode(true) as HTMLElement;
  clone.style.margin = "0";
  const body = new XMLSerializer().serializeToString(clone);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" class="sheet sx-raster" style="position:static;overflow:visible;${vars}"><style>${css.replace(/<\/style/g, "<\\/style")}</style>${body}</div></foreignObject></svg>`;
}

const load = (svg: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

/** Some browsers taint a canvas that has drawn a foreignObject, which WebGL then refuses. */
export async function canRasterize() {
  try {
    const img = await load(`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><foreignObject width="2" height="2"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject></svg>`);
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    ctx.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

/** Swap every <img> in the host for an inlined copy, so its clones carry the pixels. */
async function inlineImages(host: HTMLElement) {
  await Promise.all(
    Array.from(host.querySelectorAll("img")).map(async (img) => {
      if (!img.src.startsWith("data:")) img.src = await toDataUrl(img.src).catch(() => img.src);
    }),
  );
}

export async function rasterize(host: HTMLElement, canvas: HTMLCanvasElement, scale: number) {
  await inlineImages(host);
  const css = await collectCss();
  const cs = getComputedStyle(document.body);
  const vars = VARS.map((v) => `${v}:${cs.getPropertyValue(v)}`).join(";").replace(/"/g, "'");
  const w = host.offsetWidth;
  const h = Math.ceil(host.offsetHeight);
  const img = await load(svgFor(host, css, w, h, vars));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
}
