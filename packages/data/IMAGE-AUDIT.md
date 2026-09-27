# Uploaded still catalog

Nine supplied stills are included. All originals were copied without editing.
The new scenes and existing Spider-Man scene are linked to film titles,
years, scene names, approximate map pins, and working static image URLs.

| Film | Location | Spot ID |
| --- | --- | --- |
| The Amazing Spider-Man 2 (2014) | Times Square red steps | tasm2-red-steps |
| Enchanted (2007) | Brooklyn Bridge pedestrian walkway | enchanted-brooklyn-bridge |
| Friends with Benefits (2011) | Grand Central Terminal main concourse | friends-benefits-grand-central |
| Home Alone 2: Lost in New York (1992) | Radio City Music Hall | home-alone-radio-city |
| Home Alone 2: Lost in New York (1992) | The Battery waterfront, binocular scene | home-alone-battery-park |
| Joker (2019) | West 167th Street stairs, Shakespeare/Anderson avenues, Bronx | joker-bronx-stairs |
| Past Lives (2023) | Brooklyn Bridge Park near Jane's Carousel | past-lives-brooklyn-bridge-park |
| The Devil Wears Prada (2006) | Fifth Avenue and 55th Street; corner inferred from De Beers storefront | devil-wears-prada-fifth-avenue |
| John Wick: Chapter 2 (2017) | Bethesda Terrace Arcade, Central Park | john-wick-bethesda-terrace |

## Verification limits

The Prada movie/errands scene is identified; the street corner is a visual
inference supported by the historical De Beers location and the film location
guide, not an independently verified camera position. All pins are approximate
landmark coordinates. Eight real-world reference photos have now been downloaded
and reviewed: six approximate viewpoint candidates and two context-only photos.
Capture dates range from 2009 to 2026. See [matching handoff](PHOTO-MATCHING-HANDOFF.md)
for limitations and [reference credits](assets/spots/ATTRIBUTION.md).

Two original demo records (Ghostbusters and Night at the Museum) still have
placeholder stills. Thus the full catalog has eleven records, nine with real
uploaded stills. John Wick has a placeholder modern reference. The rejected Spider-Man pizza image remains outside the catalog
and database in incoming/. Other screenshots on the computer were not imported.

Source references, filenames and SHA-256 hashes are recorded in
[image-audit.json](data/image-audit.json). Additional Prada corner evidence:
[De Beers store at Fifth Avenue/55th Street](https://www.idexonline.com/m/FullArticle?Id=20429).

Run `npm run verify:data` to compare catalog fields with Atlas, check both
indexes, verify asset paths and compare stored image hashes. After adding photos,
use `npm run sync:images`; restart `npm run dev:match` to reload the JSON catalog.
