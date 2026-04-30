import { z } from 'zod';
import { UserRole } from './Auth.types';

const mobileRegex = /^[6-9]\d{9}$/;

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long').trim(),

  email: z
    .string()
    .email('Invalid email format')
    .transform((val) => val.toLowerCase().trim()),

  mobileNumber: z.string().regex(mobileRegex, 'Invalid mobile number'),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password too long'),

  role: z.nativeEnum(UserRole).optional().default(UserRole.CUSTOMER),
});

export type SignupInput = z.infer<typeof signupSchema>;
