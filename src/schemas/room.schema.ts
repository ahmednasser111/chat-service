import { z } from 'zod';

export const createRoomSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Room name is required')
      .max(100, 'Room name too long'),
    description: z.string().max(500, 'Description too long').optional(),
  }),
});

export const updateRoomSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid room ID format'),
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Room name is required')
      .max(100, 'Room name too long')
      .optional(),
    description: z.string().max(500, 'Description too long').optional(),
  }),
});

export const getRoomSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid room ID format'),
  }),
});

export const getRoomsSchema = z.object({
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return 20;
        const num = parseInt(val);
        return isNaN(num) ? 20 : Math.min(Math.max(num, 1), 100);
      }),
    offset: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return 0;
        const num = parseInt(val);
        return isNaN(num) ? 0 : Math.max(num, 0);
      }),
  }),
});

export const getRoomMessagesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid room ID format'),
  }),
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return 50;
        const num = parseInt(val);
        return isNaN(num) ? 50 : Math.min(Math.max(num, 1), 100);
      }),
    offset: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return 0;
        const num = parseInt(val);
        return isNaN(num) ? 0 : Math.max(num, 0);
      }),
  }),
});
