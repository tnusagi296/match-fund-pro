export type FeedSelection<GraphRecord, DemoRecord> =
  { mode: "graph"; records: GraphRecord[] } | { mode: "demo"; records: DemoRecord[] };

export function selectFounderFeed<GraphRecord, DemoRecord>(
  graphFounders: GraphRecord[],
  demoFounders: DemoRecord[],
): FeedSelection<GraphRecord, DemoRecord> {
  return graphFounders.length > 0
    ? { mode: "graph", records: graphFounders }
    : { mode: "demo", records: demoFounders };
}
