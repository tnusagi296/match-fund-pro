import { createServerFn } from "@tanstack/react-start";

export const getPublishedGraphFounders = createServerFn({ method: "GET" }).handler(async () => {
  const { loadDiscoverableGraphFounderCards } = await import("./feed.server");
  return loadDiscoverableGraphFounderCards();
});
