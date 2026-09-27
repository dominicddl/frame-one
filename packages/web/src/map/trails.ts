// Trail spotIds are real catalog ids (packages/data/data/spots.json, active only),
// listed in walking order — the map draws a dashed line through them in this order.
export const TRAIL_FILTERS = {
  all: { id: "all", label: "All", spotIds: null },
  superhero: {
    id: "superhero",
    label: "Superhero",
    spotIds: ["tasm2-red-steps", "cap-america-times-square"],
  },
  romance: {
    id: "romance",
    label: "Romance",
    spotIds: ["past-lives-brooklyn-bridge-park", "enchanted-brooklyn-bridge", "friends-benefits-central-park-mall"],
  },
  comedy: {
    id: "comedy",
    label: "Comedy",
    spotIds: [
      "home-alone-battery-park",
      "ghostbusters-firehouse",
      "home-alone-radio-city",
      "devil-wears-prada-fifth-avenue",
      "night-museum-steps",
    ],
  },
  thriller: {
    id: "thriller",
    label: "Thriller",
    spotIds: ["john-wick-bethesda-terrace", "joker-bronx-stairs"],
  },
} satisfies Record<string, { id: string; label: string; spotIds: string[] | null }>;

export type TrailFilterId = keyof typeof TRAIL_FILTERS;
