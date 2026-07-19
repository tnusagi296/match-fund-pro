import { createServerFn } from "@tanstack/react-start";

export const getPublishedGraphFounders = createServerFn({ method: "GET" }).handler(async () => {
  const { loadPublishedGraphFounderCards } = await import("./feed.server");
  return loadPublishedGraphFounderCards();
});
