# Put your photos here

Each spot has its own folder:

| Folder | Movie / location |
| --- | --- |
| `tasm2-red-steps/` | The Amazing Spider-Man 2 / Times Square |
| `ghostbusters-firehouse/` | Ghostbusters / Hook & Ladder 8 |
| `night-museum-steps/` | Night at the Museum / American Museum of Natural History |

Inside each folder, add:

- `still.jpg`: movie frame for this scene.
- `vantage.jpg`: present-day photo of the intended camera viewpoint (optional for now).

`.jpeg`, `.png`, and `.webp` also work. Keep the real file extension; do not
rename a PNG to JPG. Supply only one file per role, e.g. not both still.jpg and
still.png. You can leave the existing SVG placeholders in place.

From the repository root, run `npm run sync:images` after adding photos.
This updates only stillUrl/vantageUrl on existing MongoDB spot records and the
local JSON catalog used by the match server. Missing
photos leave existing URLs untouched. Running it again is safe. Restart the API
to reload its catalog. Replacing a photo with the same filename needs no URL sync.

MongoDB stores image URLs; the actual photos live in these folders and are
served by the API. Include these files when sharing/deploying the API. For example:
`http://localhost:3001/assets/spots/tasm2-red-steps/still.jpg`.

To add a new spot, add its metadata to `packages/data/data/spots.json`, create a
folder matching its spotId, add photos, then run `npm run seed:spots`.
Seeding also discovers photos, but updates all catalog fields; use sync:images
when you only want to update photos without overwriting database metadata.

Partner handoff: `movie_spots.spots` contains one record per scene, with `spotId`,
film/scene metadata, `location` (GeoJSON `[longitude, latitude]`), `stillUrl`,
`vantageUrl`, keywords, mergeRadiusM and active. GET /api/spots exposes the public
map metadata and image URLs. Resolve relative URLs against the API origin.
