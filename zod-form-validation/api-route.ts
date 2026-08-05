// From: https://codingdunia.com/blog/form-validation-zod-typescript/
// pages/api/register.ts (or app/api/register/route.ts) - same schema, reused server-side
import { registerSchema } from './schema';

export async function POST(req: Request) {
  const body = await req.json();
  const result = registerSchema.safeParse(body);

  if (!result.success) {
    return Response.json({ errors: result.error.flatten() }, { status: 400 });
  }

  // result.data is fully typed here too
  await createUser(result.data);
  return Response.json({ ok: true });
}

declare function createUser(data: unknown): Promise<void>;
