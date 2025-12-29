import { z } from "zod";

// ── Query schemas ──────────────────────────────────────────────────────────────

export const getUserLinksQuerySchema = z.object({
  type: z.literal("link").optional(),
});

export const getPublicLinksQuerySchema = z.object({
  type: z.literal("link").optional(),
});

export type GetUserLinksQuery = z.infer<typeof getUserLinksQuerySchema>;
export type GetPublicLinksQuery = z.infer<typeof getPublicLinksQuerySchema>;

// ── Input schemas ──────────────────────────────────────────────────────────────

export const urlValidator = z.string().refine(
  (val) => {
    try {
      const url = new URL(val);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "URL must be a valid http or https address" }
);

export const createLinkSchema = z
  .object({
    url: urlValidator,
    customCode: z.string().min(1).optional(),
    isPublic: z.boolean().default(true),
    isPasswordProtected: z.boolean().default(false),
    password: z.string().optional().nullable(),
    userId: z.string().uuid().optional().nullable(),
    type: z.literal("link").default("link"),
  })
  .refine(
    (data) =>
      !data.isPasswordProtected || (!!data.password && data.password.length >= 6),
    {
      message: "Password must be at least 6 characters when protection is enabled",
      path: ["password"],
    }
  );

export const updateLinkSchema = z
  .object({
    title: z.string().min(1).optional(),
    isPublic: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isPasswordProtected: z.boolean().optional(),
    password: z.string().optional().nullable(),
  })
  .refine(
    (data) =>
      !(data.isPasswordProtected === true && data.password != null) ||
      data.password.length >= 6,
    { message: "Password must be at least 6 characters", path: ["password"] }
  );

export const verifyPasswordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;

// ── Response schemas ───────────────────────────────────────────────────────────

export const linkResponseSchema = z.object({
  id: z.string(),
  shortCode: z.string(),
  originalUrl: z.string(),
  title: z.string().nullable(),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  isPasswordProtected: z.boolean(),
  userId: z.string().nullable(),
  type: z.string(),
  visits: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type LinkResponse = z.infer<typeof linkResponseSchema>;
