import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Thesis } from "@/lib/thesis";

const ThesisInput = z
  .object({
    stages: z.array(z.enum(["Idea", "Hackathon", "Prototype", "Pre-seed", "Seed"])).max(5),
    sectors: z
      .array(z.enum(["AI", "Climate", "Fintech", "Bio", "Devtools", "Robotics", "Consumer"]))
      .max(7),
    keywords: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
    technicalThemes: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
    preferredLanguages: z.array(z.string().trim().min(1).max(40)).max(8).optional().default([]),
    founderArchetypes: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
    desiredSignals: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
    activityRecencyDays: z.number().int().min(30).max(730).optional().default(365),
    exclusions: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
    technicalBuilderRequired: z.boolean().optional(),
    weights: z.object({
      technical: z.number().min(0).max(100),
      traction: z.number().min(0).max(100),
      fmf: z.number().min(0).max(100),
    }),
    geos: z.array(z.string().trim().min(1).max(40)).max(12),
    checkMin: z.number().min(0).max(100000),
    checkMax: z.number().min(0).max(100000),
    digestEmail: z.boolean(),
    seenCoachMark: z.boolean().optional(),
    swipeCount: z.number().int().min(0).optional(),
  })
  .refine((thesis) => thesis.checkMin <= thesis.checkMax, {
    message: "Minimum check size must not exceed maximum check size.",
  });

function parseThesis(data: unknown): Thesis {
  return ThesisInput.parse(data) as Thesis;
}

export const previewDiscoveryPlan = createServerFn({ method: "POST" })
  .validator(parseThesis)
  .handler(async ({ data }) => {
    const { DiscoveryPlanner } = await import("./planner.server");
    return new DiscoveryPlanner().plan(data);
  });

export const startFounderDiscovery = createServerFn({ method: "POST" })
  .validator(parseThesis)
  .handler(async ({ data }) => {
    const { runThesisDrivenDiscovery } = await import("./orchestrator.server");
    return runThesisDrivenDiscovery(data);
  });
