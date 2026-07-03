import type {
  AppStatus,
  AssetFilters,
  BackupResult,
  Brand,
  BusinessSettings,
  Category,
  CategoryScope,
  CheckoutInput,
  ConditionRating,
  CustomFieldDef,
  CustomFieldEntity,
  CustomFieldType,
  CustomFieldValue,
  DashboardStats,
  EquipmentType,
  ImportSummary,
  MovementType,
  PoStatus,
  Product,
  ProductFilters,
  ProductInput,
  PurchaseOrder,
  PurchaseOrderInput,
  ReceiveLineInput,
  RentalAsset,
  RentalAssetInput,
  RentalEvent,
  RentalStatus,
  ReportRequest,
  ReportResult,
  Sale,
  SaleFilters,
  SaleInput,
  SearchResultItem,
  SetupInput,
  StockAdjustmentInput,
  StockMovement,
  MigrationEntity,
  MigrationFilePreview,
  MigrationMapping,
  ValidationResult,
  ImportSummaryResult,
  Supplier
} from './types'

export interface SupplierInput {
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  notes?: string | null
}

export interface EventExtra {
  customerName?: string | null
  staffName?: string | null
  dueDate?: string | null
  condition?: ConditionRating | null
  notes?: string | null
}

/**
 * The full typed API exposed to the renderer via the preload bridge.
 * Every call is asynchronous IPC into the main process repositories.
 */
export interface OseaApi {
  app: {
    getStatus(): Promise<AppStatus>
    getDefaultDataDir(): Promise<string>
    setup(input: SetupInput): Promise<AppStatus>
    chooseDirectory(): Promise<string | null>
    chooseSavePath(defaultName: string, filterName: string, extensions: string[]): Promise<string | null>
    chooseFile(filterName: string, extensions: string[]): Promise<string | null>
    chooseFiles(filterName: string, extensions: string[]): Promise<string[]>
    showInFolder(path: string): Promise<void>
    printToPdf(defaultName: string): Promise<string | null>
    print(): Promise<void>
    getLastPrompt(): Promise<string | null>
    openUserManual(): Promise<void>
  }
  settings: {
    get(): Promise<BusinessSettings>
    update(patch: Partial<BusinessSettings>): Promise<BusinessSettings>
  }
  catalog: {
    listCategories(scope?: CategoryScope | 'all'): Promise<Category[]>
    createCategory(name: string, scope: CategoryScope): Promise<Category>
    updateCategory(id: string, name: string, scope: CategoryScope): Promise<void>
    deleteCategory(id: string): Promise<void>
    listEquipmentTypes(): Promise<EquipmentType[]>
    createEquipmentType(name: string, categoryId: string | null): Promise<EquipmentType>
    updateEquipmentType(id: string, name: string, categoryId: string | null): Promise<void>
    deleteEquipmentType(id: string): Promise<void>
    listBrands(): Promise<Brand[]>
    createBrand(name: string): Promise<Brand>
    deleteBrand(id: string): Promise<void>
    listSuppliers(includeArchived?: boolean): Promise<Supplier[]>
    createSupplier(input: SupplierInput): Promise<Supplier>
    updateSupplier(id: string, input: SupplierInput): Promise<void>
    setSupplierArchived(id: string, archived: boolean): Promise<void>
  }
  assets: {
    list(filters?: AssetFilters): Promise<RentalAsset[]>
    get(id: string): Promise<RentalAsset | null>
    getByNumber(assetNumber: string): Promise<RentalAsset | null>
    create(input: RentalAssetInput, quantity?: number): Promise<RentalAsset[]>
    update(id: string, input: RentalAssetInput): Promise<RentalAsset>
    setArchived(id: string, archived: boolean): Promise<void>
    checkOut(id: string, input: CheckoutInput): Promise<RentalAsset>
    reserve(id: string, input: CheckoutInput): Promise<RentalAsset>
    return(id: string, extra?: EventExtra): Promise<RentalAsset>
    setStatus(id: string, status: RentalStatus, extra?: EventExtra): Promise<RentalAsset>
    completeService(id: string, extra?: EventExtra): Promise<RentalAsset>
    addNote(id: string, notes: string, staffName?: string | null): Promise<void>
    events(assetId: string, limit?: number): Promise<RentalEvent[]>
  }
  products: {
    list(filters?: ProductFilters): Promise<Product[]>
    get(id: string): Promise<Product | null>
    getByCode(code: string): Promise<Product | null>
    create(input: ProductInput): Promise<Product>
    update(id: string, input: ProductInput): Promise<Product>
    setArchived(id: string, archived: boolean): Promise<void>
    adjust(input: StockAdjustmentInput): Promise<StockMovement>
    movements(productId?: string, limit?: number): Promise<StockMovement[]>
  }
  sales: {
    list(filters?: SaleFilters, limit?: number): Promise<Sale[]>
    get(id: string): Promise<Sale | null>
    create(input: SaleInput): Promise<Sale>
  }
  po: {
    list(status?: PoStatus | 'all'): Promise<PurchaseOrder[]>
    get(id: string): Promise<PurchaseOrder | null>
    create(input: PurchaseOrderInput): Promise<PurchaseOrder>
    updateStatus(id: string, status: PoStatus): Promise<PurchaseOrder>
    receive(id: string, receipts: ReceiveLineInput[]): Promise<PurchaseOrder>
    deleteDraft(id: string): Promise<void>
  }
  reports: {
    dashboard(): Promise<DashboardStats>
    run(req: ReportRequest): Promise<ReportResult>
    search(query: string, limit?: number): Promise<SearchResultItem[]>
  }
  custom: {
    list(entity?: CustomFieldEntity): Promise<CustomFieldDef[]>
    create(
      entity: CustomFieldEntity,
      name: string,
      fieldType: CustomFieldType,
      options?: string[]
    ): Promise<CustomFieldDef>
    delete(id: string): Promise<void>
    values(entity: CustomFieldEntity, recordId: string): Promise<CustomFieldValue[]>
    setValue(fieldId: string, recordId: string, value: string | null): Promise<void>
  }
  data: {
    backup(destPath: string): Promise<BackupResult>
    restore(srcPath: string): Promise<void>
    exportJson(destPath: string): Promise<ImportSummary>
    importJson(srcPath: string): Promise<ImportSummary>
    exportCsv(
      destPath: string,
      columns: Array<{ key: string; label: string }>,
      rows: Array<Record<string, string | number | null>>
    ): Promise<void>
    runValidationSuite(): Promise<void>
    generateTestDataset(preset: 'small' | 'medium' | 'large'): Promise<{ path: string }>
    exportDemoDatabase(): Promise<{ path: string }>
    dbInfo(): Promise<{ path: string; counts: Record<string, number> }>
  }
  migration: {
    inspectFiles(paths: string[]): Promise<MigrationFilePreview[]>
    validateMapping(fileId: string, entity: MigrationEntity, mapping: MigrationMapping): Promise<ValidationResult>
    importData(fileId: string, entity: MigrationEntity, mapping: MigrationMapping, skipDuplicates: boolean): Promise<ImportSummaryResult>
  }
}

// convenience re-export so renderer code can import movement types with the API
export type { MovementType }
