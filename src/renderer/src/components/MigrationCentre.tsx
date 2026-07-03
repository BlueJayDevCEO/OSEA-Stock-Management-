import { useState } from 'react'
import { FileUp, CheckCircle, AlertTriangle, XCircle, ArrowRight, Play, ServerCrash } from 'lucide-react'
import type { MigrationFilePreview, MigrationEntity, MigrationMapping, ValidationResult, ImportSummaryResult } from '@shared/types'
import { autoMapMigrationHeaders, MIGRATION_ENTITY_FIELDS } from '@shared/migration'
import { useApp } from '../lib/store'

const ENTITIES: MigrationEntity[] = ['RentalAssets', 'Cylinders', 'RetailProducts', 'Suppliers', 'Customers']

export function MigrationCentre(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [files, setFiles] = useState<MigrationFilePreview[]>([])

  // State per file
  const [entities, setEntities] = useState<Record<string, MigrationEntity>>({})
  const [mappings, setMappings] = useState<Record<string, MigrationMapping>>({})
  const [validations, setValidations] = useState<Record<string, ValidationResult>>({})
  const [summaries, setSummaries] = useState<Record<string, ImportSummaryResult>>({})

  const pickFiles = async () => {
    try {
      const paths = await window.osea.app.chooseFiles('Data Files', ['csv', 'xlsx', 'xls', 'json'])
      if (!paths || paths.length === 0) return

      const previews = await window.osea.migration.inspectFiles(paths)
      setFiles(previews)

      const newEntities: Record<string, MigrationEntity> = {}
      const newMappings: Record<string, MigrationMapping> = {}

      previews.forEach(p => {
        const ent = p.suggestedEntity || 'RentalAssets'
        newEntities[p.fileId] = ent
        newMappings[p.fileId] = autoMapMigrationHeaders(ent, p.headers)
      })

      setEntities(newEntities)
      setMappings(newMappings)
      setStep(2)
    } catch (e: any) {
      toast('error', e.message || 'Could not inspect the selected files.')
    }
  }

  const runValidation = async (fileId: string) => {
    try {
      const res = await window.osea.migration.validateMapping(fileId, entities[fileId], mappings[fileId])
      setValidations(v => ({ ...v, [fileId]: res }))
    } catch (e: any) {
      toast('error', e.message)
    }
  }

  const validateAll = async () => {
    for (const f of files) {
      await runValidation(f.fileId)
    }
  }

  const doImport = async (fileId: string, skipDuplicates: boolean) => {
    try {
      const res = await window.osea.migration.importData(fileId, entities[fileId], mappings[fileId], skipDuplicates)
      setSummaries(s => ({ ...s, [fileId]: res }))
      toast('success', `Imported ${res.importedCount} records from ${files.find(f => f.fileId === fileId)?.fileName}`)
    } catch (e: any) {
      toast('error', e.message)
      setSummaries(s => ({ ...s, [fileId]: { importedCount: 0, skippedCount: 0, failedCount: 0, errors: [e.message] } }))
    }
  }

  const importAll = async () => {
    setStep(3)
    for (const f of files) {
      await doImport(f.fileId, true)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Data Migration Centre</h2>
        {step === 1 && (
          <button className="btn-primary" onClick={pickFiles}>
            <FileUp size={16} /> Select Files
          </button>
        )}
        {step === 2 && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn-secondary" onClick={validateAll}>Re-Validate</button>
            <button className="btn-primary" onClick={importAll}>
              <Play size={16} /> Confirm & Import All
            </button>
          </div>
        )}
        {step === 3 && (
          <button className="btn-secondary" onClick={() => { setStep(1); setFiles([]); setSummaries({}); }}>
            New Migration
          </button>
        )}
      </div>

      {step === 1 && (
        <div className="card p-8 text-center text-abyss-400">
          <ServerCrash size={48} className="mx-auto mb-4 opacity-50" />
          <p>Select one or more CSV, Excel, or JSON files to bring your existing data into OSEA Dive Manager.</p>
        </div>
      )}

      {step === 2 && files.map(f => {
        const val = validations[f.fileId]
        const mapping = mappings[f.fileId] || {}
        return (
          <div key={f.fileId} className="card p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg text-abyss-100">{f.fileName}</h3>
                <p className="text-sm text-abyss-400">{f.rowCount} rows detected</p>
              </div>
              <select
                className="input"
                value={entities[f.fileId]}
                onChange={(e) => {
                  setEntities(prev => ({ ...prev, [f.fileId]: e.target.value as MigrationEntity }))
                  setMappings(prev => ({ ...prev, [f.fileId]: {} }))
                }}
              >
                {ENTITIES.map(ent => <option key={ent} value={ent}>{ent}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold uppercase text-abyss-400">Column Mapping</h4>
                {MIGRATION_ENTITY_FIELDS[entities[f.fileId]].map(field => (
                  <div key={field.key} className="flex items-center justify-between text-sm">
                    <span className={field.required ? 'font-semibold' : ''}>{field.label}{field.required ? '*' : ''}</span>
                    <select
                      className="input py-1 text-xs w-48"
                      value={mapping[field.key] || ''}
                      onChange={(e) => {
                        setMappings(prev => ({ ...prev, [f.fileId]: { ...mapping, [field.key]: e.target.value } }))
                      }}
                    >
                      <option value="">-- Skip --</option>
                      {f.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="space-y-2 bg-abyss-800/50 p-3 rounded-lg border border-abyss-700">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold uppercase text-abyss-400">Validation Status</h4>
                  <button className="btn-secondary py-1 px-2 text-xs" onClick={() => runValidation(f.fileId)}>Check</button>
                </div>
                {!val ? (
                  <p className="text-sm text-abyss-500">Not validated yet.</p>
                ) : (
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400"><CheckCircle size={14} /> {val.validCount} Valid Rows</div>
                    {val.invalidRows.length > 0 && (
                      <div className="text-red-400 font-medium">
                        <XCircle size={14} className="inline mr-1" /> {val.invalidRows.length} Invalid Rows
                        <ul className="list-disc pl-5 mt-1 text-xs space-y-1">
                          {val.invalidRows.slice(0, 3).map((err, i) => (
                            <li key={i}>Row {err.row}: {err.errors.join(', ')}</li>
                          ))}
                          {val.invalidRows.length > 3 && <li>...and {val.invalidRows.length - 3} more</li>}
                        </ul>
                      </div>
                    )}
                    {val.duplicates.length > 0 && (
                      <div className="text-orange-400 font-medium">
                        <AlertTriangle size={14} className="inline mr-1" /> {val.duplicates.length} DB Duplicates
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {step === 3 && files.map(f => {
        const sum = summaries[f.fileId]
        return (
          <div key={f.fileId} className="card p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg text-abyss-100">{f.fileName}</h3>
              <p className="text-sm text-abyss-400">{entities[f.fileId]}</p>
            </div>
            {!sum ? (
              <span className="text-abyss-400 animate-pulse">Importing...</span>
            ) : (
              <div className="text-right text-sm">
                <div className="text-emerald-400 font-medium">{sum.importedCount} Imported</div>
                {sum.skippedCount > 0 && <div className="text-orange-400">{sum.skippedCount} Skipped</div>}
                {sum.failedCount > 0 && <div className="text-red-400">{sum.failedCount} Failed</div>}
                {sum.errors.length > 0 && <div className="text-red-400 mt-1 text-xs max-w-xs truncate">{sum.errors[0]}</div>}
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
