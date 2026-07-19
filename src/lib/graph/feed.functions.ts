import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublishedGraphFounders = createServerFn({ method: "GET" }).handler(async () => {
  const { loadDiscoverableGraphFounderCards } = await import("./feed.server");
  return loadDiscoverableGraphFounderCards();
});

const GraphFounderInput = z.object({
  profileId: z.string().trim().min(1).max(128),
});

export const getGraphFounderById = createServerFn({ method: "GET" })
  .validator((input) => GraphFounderInput.parse(input))
  .handler(async ({ data }) => {
    const { loadDiscoverableGraphFounderCards } = await import("./feed.server");
    const founders = await loadDiscoverableGraphFounderCards();
    return founders.find((founder) => founder.id === data.profileId) ?? null;
  });
