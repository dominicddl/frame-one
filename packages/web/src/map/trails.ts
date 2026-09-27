export const TRAIL_FILTERS = {
  all: { id: "all", label: "All", spotIds: null },
  marvel: {
    id: "marvel",
    label: "Marvel",
    spotIds: ["tasm2-red-steps", "cap-america-times-square"],
  },
  romcom: {
    id: "romcom",
    label: "Romcom",
    spotIds: ["friends-benefits-central-park-mall", "home-alone-radio-city"],
  },
  dark: {
    id: "dark",
    label: "Dark",
    spotIds: ["joker-bronx-stairs"],
  },
} satisfies Record<string, { id: string; label: string; spotIds: string[] | null }>;

export type TrailFilterId = keyof typeof TRAIL_FILTERS;
