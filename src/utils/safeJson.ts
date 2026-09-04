import { z } from 'zod';

// 1. Define an explicit, strict schema
export const UserInputSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
  tags: z.array(z.string()).max(10).default([]),
}).strict(); // `.strict()` rejects unexpected or injected keys

export type UserInput = z.infer<typeof UserInputSchema>;

/**
 * Safely parses and validates an untrusted JSON string.
 */
export function safeParseJson<T>(
  rawJson: string, 
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  let parsed: unknown;
  try {
    // Reviver function neutralizes prototype pollution attempts
    parsed = JSON.parse(rawJson, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
  } catch (err) {
    return { success: false, error: 'Invalid JSON format' };
  }

  // Schema validation & type checking
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { 
      success: false, 
      error: `Validation failed: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}` 
    };
  }

  return { success: true, data: result.data };
}
