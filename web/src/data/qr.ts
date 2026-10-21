// QR codes for the personal links, made at build time (no QR code runs in
// the browser, and no outside service is used). The encoding is done by
// qrcode-generator (MIT, no dependencies); the SVG is drawn here so its
// colours never depend on the theme:
//   - dark modules (#000) on a white background (#fff), always;
//   - a quiet zone of 4 modules on every side (the QR standard's minimum),
//     part of the image itself, so a dark theme can't eat into it;
//   - error correction level M (about 15% of the code can be damaged or
//     obscured and it still scans): enough for a code shown on a screen,
//     and smaller than Q or H, so each module is bigger at the same size.
import qrcode from "qrcode-generator";

export const QUIET_ZONE = 4;
export const ERROR_CORRECTION = "M";

/** The QR code for `text` as a standalone SVG document. */
export function qrSvg(text: string): string {
  const qr = qrcode(0, ERROR_CORRECTION); // 0 = the smallest version that fits
  qr.addData(text, "Byte");
  qr.make();
  const count = qr.getModuleCount();
  const size = count + 2 * QUIET_ZONE;
  // One rectangle per horizontal run of dark modules (smaller than one per module).
  let path = "";
  for (let row = 0; row < count; row++) {
    let col = 0;
    while (col < count) {
      if (!qr.isDark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < count && qr.isDark(row, col)) col++;
      const run = col - start;
      path += `M${start + QUIET_ZONE} ${row + QUIET_ZONE}h${run}v1h-${run}z`;
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="#fff"/>`,
    `<path d="${path}" fill="#000"/>`,
    "</svg>",
  ].join("");
}
