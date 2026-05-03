import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const animationsTable = pgTable("animations", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("pending"),
  videoUrl: text("video_url"),
  manimCode: text("manim_code"),
  errorMessage: text("error_message"),
  durationSeconds: real("duration_seconds"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAnimationSchema = createInsertSchema(animationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnimation = z.infer<typeof insertAnimationSchema>;
export type Animation = typeof animationsTable.$inferSelect;
