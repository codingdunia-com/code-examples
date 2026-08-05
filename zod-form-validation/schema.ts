// From: https://codingdunia.com/blog/form-validation-zod-typescript/
import { z } from 'zod';

export const registerSchema = z
  .object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
  });

export type RegisterForm = z.infer<typeof registerSchema>;

export const dateRangeSchema = z
  .object({
      startDate: z.string(),
      endDate: z.string(),
  })
  .superRefine((data, ctx) => {
      if (data.endDate < data.startDate) {
          ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'End date must be after start date',
              path: ['endDate'],
          });
      }
      if (data.startDate === data.endDate) {
          ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Start and end date cannot be the same',
              path: ['startDate'],
          });
      }
  });
