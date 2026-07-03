import type {
  CustomFieldDef,
  CustomFieldEntity,
  CustomFieldType,
  CustomFieldValue
} from '@shared/types'
import { getDb } from '../db'
import { newId, nowIso } from '../db/ids'

interface FieldRow {
  id: string
  entity: CustomFieldEntity
  name: string
  field_type: CustomFieldType
  options: string
  created_at: string
}

function parseOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function listCustomFields(entity?: CustomFieldEntity): CustomFieldDef[] {
  const db = getDb()
  const rows = entity
    ? db.all<FieldRow>('SELECT * FROM custom_fields WHERE entity = ? AND archived = 0 ORDER BY name', [entity])
    : db.all<FieldRow>('SELECT * FROM custom_fields WHERE archived = 0 ORDER BY entity, name')
  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    name: r.name,
    fieldType: r.field_type,
    options: parseOptions(r.options),
    createdAt: r.created_at
  }))
}

export function createCustomField(
  entity: CustomFieldEntity,
  name: string,
  fieldType: CustomFieldType,
  options: string[] = []
): CustomFieldDef {
  const db = getDb()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Field name is required.')
  const id = newId()
  const ts = nowIso()
  db.run(
    'INSERT INTO custom_fields (id, entity, name, field_type, options, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, entity, trimmed, fieldType, JSON.stringify(options), ts]
  )
  return { id, entity, name: trimmed, fieldType, options, createdAt: ts }
}

export function deleteCustomField(id: string): void {
  getDb().run('UPDATE custom_fields SET archived = 1 WHERE id = ?', [id])
}

export function getCustomFieldValues(
  entity: CustomFieldEntity,
  recordId: string
): CustomFieldValue[] {
  const db = getDb()
  const rows = db.all<FieldRow & { value: string | null }>(
    `SELECT f.*, v.value
     FROM custom_fields f
     LEFT JOIN custom_field_values v ON v.field_id = f.id AND v.record_id = ?
     WHERE f.entity = ? ORDER BY f.name`,
    [recordId, entity]
  )
  return rows.map((r) => ({
    fieldId: r.id,
    fieldName: r.name,
    fieldType: r.field_type,
    options: parseOptions(r.options),
    value: r.value ?? null
  }))
}

export function setCustomFieldValue(fieldId: string, recordId: string, value: string | null): void {
  const db = getDb()
  if (value === null || value === '') {
    db.run('DELETE FROM custom_field_values WHERE field_id = ? AND record_id = ?', [
      fieldId,
      recordId
    ])
    return
  }
  db.run(
    `INSERT INTO custom_field_values (id, field_id, record_id, value) VALUES (?, ?, ?, ?)
     ON CONFLICT(field_id, record_id) DO UPDATE SET value = excluded.value`,
    [newId(), fieldId, recordId, value]
  )
}
