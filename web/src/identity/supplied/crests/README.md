# Supplied club crests

Custom club-inspired artwork — user supplied, AI-generated design reference.
The site's owner made these images with an AI image tool and chose them as
the full crests for seven Bundesliga clubs and seven Serie A clubs
(Atalanta, Frosinone, Genoa, Lecce, Roma, Torino, Lazio) on 28 Nov 2026. They are not
official or licensed, and several look very close to the clubs' official
badges: what each one is and its resemblance are in `../../supplied.ts`,
and a unit test keeps that list and these files in step.

Prepared from the supplied images: faint edge haze cleared, cropped to the
crest, centred on a transparent square without stretching, 240 px WebP at
quality 75, within the supplied crest budget (`SUPPLIED_CREST_BUDGET`).

Only the full crest comes from here. At 24 px and below the club's own
small SVG crest is used, because a detailed image turns to noise that small.

**Private until cleared.** The image files here are ignored by git and never
committed: the repository is public, and this artwork has no legal basis for
publication yet. They are used when present on the owner's machine; a public
checkout (and CI) has none, so these clubs and leagues show TableTalk's own
SVG artwork instead. Keep the originals somewhere safe outside the repository.
