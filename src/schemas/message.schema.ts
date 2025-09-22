import { z } from 'zod';

export const createMessageSchema = z.object({
  body: z.object({
    text: z
      .string()
      .min(1, 'Message text is required')
      .max(1000, 'Message too long (max 1000 characters)'),
    roomId: z.string().optional().default('global'),
  }),
});

export const updateMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid message ID format'),
  }),
  body: z.object({
    text: z
      .string()
      .min(1, 'Message text is required')
      .max(1000, 'Message too long (max 1000 characters)'),
  }),
});

export const deleteMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid message ID format'),
  }),
});

export const getMessagesSchema = z.object({
  query: z.object({
    roomId: z.string().optional(),
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

export const getMessagesByRoomSchema = z.object({
  params: z.object({
    roomId: z.string().min(1, 'Room ID is required'),
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
