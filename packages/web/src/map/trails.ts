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
    spotIds: ["friends-benefits-central-park-mall"],
  },
  comedy: {
    id: "comedy",
    label: "Comedy",
    spotIds: ["home-alone-radio-city"],
  },
  thriller: {
    id: "thriller",
    label: "Thriller",
    spotIds: ["joker-bronx-stairs"],
  },
} satisfies Record<string, { id: string; label: string; spotIds: string[] | null }>;

export type TrailFilterId = keyof typeof TRAIL_FILTERS;
