// The committed share images (public/share/, drawn by
// scripts/make-share-images.mjs) match the leagues and the size the pages
// announce, and each page type gets the right one.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEAGUES } from "../../src/data/leagues.ts";
import { SHARE_IMAGE, shareImage } from "../../src/data/share.ts";

/** A PNG's width and height, from its IHDR chunk. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(new URL(`../../public${path}`, import.meta.url));
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("share images", () => {
  it("one for the site and one per league, each 1200 x 630", () => {
    for (const image of [shareImage(), ...LEAGUES.map((league) => shareImage(league))]) {
      expect(pngSize(image.path), image.path).toEqual({
        width: SHARE_IMAGE.width,
        height: SHARE_IMAGE.height,
      });
    }
  });

  it("league pages get their league's image; other pages the site's", () => {
    const laLiga = LEAGUES.find((league) => league.slug === "la-liga")!;
    expect(shareImage(laLiga)).toEqual({
      path: "/share/la-liga.png",
      alt: "TableTalk: La Liga. Title, top places and relegation chances, updated every night. Model probabilities, not betting advice.",
    });
    expect(shareImage().path).toBe("/share/tabletalk.png");
  });
});
