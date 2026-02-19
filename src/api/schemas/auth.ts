import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string(),
  role: z.string().optional(), // Default handled in service
});

export const verify2FASchema = z.object({
  token: z.string().length(6),
});

export const validate2FASchema = z.object({
  userId: z.string().uuid(),
  token: z.string().length(6),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type Verify2FAInput = z.infer<typeof verify2FASchema>;
export type Validate2FAInput = z.infer<typeof validate2FASchema>;
