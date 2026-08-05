# Zod Form Validation

Schema-first form validation: one Zod schema drives both runtime validation and the static TypeScript type, on the client and the server.

- `schema.ts` - the Zod schema + inferred type, plus a `superRefine` example for cross-field date-range checks
- `RegistrationForm.tsx` - React Hook Form wired up via `zodResolver`
- `api-route.ts` - the same schema reused server-side (`safeParse`) so client validation and the real server-side check never drift apart

```bash
npm install zod react-hook-form @hookform/resolvers
```

Full write-up: [Form Validation with Zod and TypeScript](https://codingdunia.com/blog/form-validation-zod-typescript/)
