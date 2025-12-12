import { z } from "zod";

// ── Input schemas ──────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string(),
});

export const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// ── Response schemas ───────────────────────────────────────────────────────────

export const userResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  createdAt: z.date(),
});

export const authResponseSchema = z.object({
  user: userResponseSchema,
  accessToken: z.string(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
