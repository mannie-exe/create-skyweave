import { z } from 'zod'
import {
  artifactSchema,
  digestSchema,
  scopeSchema,
} from '../../src/lib/workspace/contracts.ts'

export const artifactFormats: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
}
export const generationSchema = z.strictObject({
  schema: z.literal(1),
  id: z.uuid(),
  scope: scopeSchema,
  namespace: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  inputRevision: digestSchema,
  inputs: z.record(z.string(), digestSchema),
  files: z.record(z.string(), artifactSchema),
  publishedAt: z.iso.datetime(),
  dependencies: z
    .array(z.strictObject({ scope: scopeSchema, generationId: z.uuid() }))
    .max(100)
    .default([]),
})
export type Generation = z.infer<typeof generationSchema>
