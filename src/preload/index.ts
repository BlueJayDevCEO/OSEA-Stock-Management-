import { contextBridge, ipcRenderer } from 'electron'
import type { OseaApi } from '@shared/api'
import type { Result } from '@shared/types'

/**
 * Preload bridge. The renderer never touches Node or Electron directly —
 * it sees a single typed `window.osea` API. Every call round-trips to the
 * main process repositories and errors surface as rejected promises.
 */
async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (res && res.ok) return res.data
  throw new Error(res && !res.ok ? res.error : 'The application backend did not respond.')
}

const api: OseaApi = {
  app: {
    getStatus: () => call('app:getStatus'),
    getDefaultDataDir: () => call('app:getDefaultDataDir'),
    checkDataDir: (dataDir) => call('app:checkDataDir', dataDir),
    setup: (input) => call('app:setup', input),
    chooseDirectory: () => call('app:chooseDirectory'),
    chooseSavePath: (defaultName, filterName, extensions) =>
      call('app:chooseSavePath', defaultName, filterName, extensions),
    chooseFile: (filterName, extensions) => call('app:chooseFile', filterName, extensions),
    chooseFiles: (filterName, extensions) => call('app:chooseFiles', filterName, extensions),
    showInFolder: (path) => call('app:showInFolder', path),
    printToPdf: (defaultName) => call('app:printToPdf', defaultName),
    print: () => call('app:print'),
    getLastPrompt: () => call('app:getLastPrompt'),
    openUserManual: () => call('app:openUserManual')
  },
  settings: {
    get: () => call('settings:get'),
    update: (patch) => call('settings:update', patch)
  },
  catalog: {
    listCategories: (scope) => call('catalog:listCategories', scope),
    createCategory: (name, scope) => call('catalog:createCategory', name, scope),
    updateCategory: (id, name, scope) => call('catalog:updateCategory', id, name, scope),
    deleteCategory: (id) => call('catalog:deleteCategory', id),
    listEquipmentTypes: () => call('catalog:listEquipmentTypes'),
    createEquipmentType: (name, categoryId) => call('catalog:createEquipmentType', name, categoryId),
    updateEquipmentType: (id, name, categoryId) =>
      call('catalog:updateEquipmentType', id, name, categoryId),
    deleteEquipmentType: (id) => call('catalog:deleteEquipmentType', id),
    listBrands: () => call('catalog:listBrands'),
    createBrand: (name) => call('catalog:createBrand', name),
    deleteBrand: (id) => call('catalog:deleteBrand', id),
    listSuppliers: (includeArchived) => call('catalog:listSuppliers', includeArchived),
    createSupplier: (input) => call('catalog:createSupplier', input),
    updateSupplier: (id, input) => call('catalog:updateSupplier', id, input),
    setSupplierArchived: (id, archived) => call('catalog:setSupplierArchived', id, archived)
  },
  assets: {
    list: (filters) => call('assets:list', filters),
    get: (id) => call('assets:get', id),
    getByNumber: (assetNumber) => call('assets:getByNumber', assetNumber),
    create: (input, quantity) => call('assets:create', input, quantity),
    update: (id, input) => call('assets:update', id, input),
    setArchived: (id, archived) => call('assets:setArchived', id, archived),
    checkOut: (id, input) => call('assets:checkOut', id, input),
    reserve: (id, input) => call('assets:reserve', id, input),
    return: (id, extra) => call('assets:return', id, extra),
    setStatus: (id, status, extra) => call('assets:setStatus', id, status, extra),
    completeService: (id, extra) => call('assets:completeService', id, extra),
    addNote: (id, notes, staffName) => call('assets:addNote', id, notes, staffName),
    events: (assetId, limit) => call('assets:events', assetId, limit)
  },
  products: {
    list: (filters) => call('products:list', filters),
    get: (id) => call('products:get', id),
    getByCode: (code) => call('products:getByCode', code),
    create: (input) => call('products:create', input),
    update: (id, input) => call('products:update', id, input),
    setArchived: (id, archived) => call('products:setArchived', id, archived),
    adjust: (input) => call('products:adjust', input),
    movements: (productId, limit) => call('products:movements', productId, limit)
  },
  sales: {
    list: (filters, limit) => call('sales:list', filters, limit),
    get: (id) => call('sales:get', id),
    create: (input) => call('sales:create', input)
  },
  po: {
    list: (status) => call('po:list', status),
    get: (id) => call('po:get', id),
    create: (input) => call('po:create', input),
    updateStatus: (id, status) => call('po:updateStatus', id, status),
    receive: (id, receipts) => call('po:receive', id, receipts),
    deleteDraft: (id) => call('po:deleteDraft', id)
  },
  reports: {
    dashboard: () => call('reports:dashboard'),
    run: (req) => call('reports:run', req),
    search: (query, limit) => call('reports:search', query, limit)
  },
  custom: {
    list: (entity) => call('custom:list', entity),
    create: (entity, name, fieldType, options) =>
      call('custom:create', entity, name, fieldType, options),
    delete: (id) => call('custom:delete', id),
    values: (entity, recordId) => call('custom:values', entity, recordId),
    setValue: (fieldId, recordId, value) => call('custom:setValue', fieldId, recordId, value)
  },
  data: {
    backup: (destPath) => call('data:backup', destPath),
    restore: (srcPath) => call('data:restore', srcPath),
    exportJson: (destPath) => call('data:exportJson', destPath),
    importJson: (srcPath) => call('data:importJson', srcPath),
    exportCsv: (destPath, columns, rows) => call('data:exportCsv', destPath, columns, rows),
    runValidationSuite: () => call('data:runValidationSuite'),
    generateTestDataset: (preset) => call('data:generateTestDataset', preset),
    exportDemoDatabase: () => call('data:exportDemoDatabase'),
    dbInfo: () => call('data:dbInfo')
  },
  migration: {
    inspectFiles: (paths) => call('migration:inspectFiles', paths),
    validateMapping: (fileId, entity, mapping) => call('migration:validateMapping', fileId, entity, mapping),
    importData: (fileId, entity, mapping, skipDuplicates) => call('migration:importData', fileId, entity, mapping, skipDuplicates)
  }
}

contextBridge.exposeInMainWorld('osea', api)
