import { z } from 'zod';

export const createMessageSchema = z.object({
  body: z.object({
    text: z.string().min(1).max(1000),
    roomId: z.string().optional(),
  }),
});

export const getMessagesSchema = z.object({
  query: z.object({
    roomId: z.string().optional(),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 50)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 0)),
  }),
});
