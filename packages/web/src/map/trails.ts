export const TRAIL_FILTERS = {
  all: { id: "all", label: "All", spotIds: null },
  marvel: {
    id: "marvel",
    label: "Marvel",
    // TODO: add Captain America GCT spotId when available
    spotIds: ["tasm2-red-steps"],
  },
  romcom: {
    id: "romcom",
    label: "Romcom",
    spotIds: ["friends-benefits-grand-central", "home-alone-radio-city"],
  },
  dark: {
    id: "dark",
    label: "Dark",
    spotIds: ["joker-bronx-stairs"],
  },
} satisfies Record<string, { id: string; label: string; spotIds: string[] | null }>;

export type TrailFilterId = keyof typeof TRAIL_FILTERS;
