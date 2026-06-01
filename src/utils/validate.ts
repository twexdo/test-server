import { z } from 'zod'

// Property name: alphanumeric, hyphens, dots, underscores only
const propertyNameSchema = z.string().regex(/^[a-zA-Z0-9._-]+$/, 'Invalid property name')

// Property value: printable ASCII, no shell metacharacters
const propertyValueSchema = z.string().regex(/^[^\x00-\x1F\x7F`$\\|;&<>(){}]*$/, 'Invalid property value').max(512)

// Backup name: strict format
const backupNameSchema = z.string().regex(/^backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.tar\.gz$/, 'Invalid backup name')

export const propertiesUpdateSchema = z.object({
  properties: z.record(propertyNameSchema, propertyValueSchema),
})

export const backupRestoreSchema = z.object({
  name: backupNameSchema,
})

export const backupDeleteSchema = z.object({
  name: backupNameSchema,
})

export { propertyNameSchema, propertyValueSchema, backupNameSchema }