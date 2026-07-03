import { getDb } from '../db'
import { nowIso } from '../db/ids'

export interface Cylinder {
  id: string
  visualInspectionDate: string | null
  nextVisualDue: string | null
  hydroTestDate: string | null
  nextHydroDue: string | null
  valveService: string | null
  o2Clean: boolean
  workingPressure: string | null
  waterCapacity: string | null
  currentGas: string | null
  nitroxCompatible: boolean
  ownership: string | null
  rentalCount: number
}

export function updateCylinderDetails(id: string, details: Partial<Cylinder>): void {
  const db = getDb()
  const exists = db.get<{id: string}>('SELECT id FROM cylinders WHERE id = ?', [id])
  if (!exists) {
    db.run(
      `INSERT INTO cylinders (id, visual_inspection_date, next_visual_due, hydro_test_date, next_hydro_due, valve_service, o2_clean, working_pressure, water_capacity, current_gas, nitrox_compatible, ownership)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        details.visualInspectionDate || null,
        details.nextVisualDue || null,
        details.hydroTestDate || null,
        details.nextHydroDue || null,
        details.valveService || null,
        details.o2Clean ? 1 : 0,
        details.workingPressure || null,
        details.waterCapacity || null,
        details.currentGas || null,
        details.nitroxCompatible ? 1 : 0,
        details.ownership || null
      ]
    )
  } else {
    // Update existing
    db.run(
      `UPDATE cylinders SET
         visual_inspection_date = COALESCE(?, visual_inspection_date),
         next_visual_due = COALESCE(?, next_visual_due),
         hydro_test_date = COALESCE(?, hydro_test_date),
         next_hydro_due = COALESCE(?, next_hydro_due),
         valve_service = COALESCE(?, valve_service),
         o2_clean = COALESCE(?, o2_clean),
         working_pressure = COALESCE(?, working_pressure),
         water_capacity = COALESCE(?, water_capacity),
         current_gas = COALESCE(?, current_gas),
         nitrox_compatible = COALESCE(?, nitrox_compatible),
         ownership = COALESCE(?, ownership)
       WHERE id = ?`,
      [
        details.visualInspectionDate,
        details.nextVisualDue,
        details.hydroTestDate,
        details.nextHydroDue,
        details.valveService,
        details.o2Clean !== undefined ? (details.o2Clean ? 1 : 0) : null,
        details.workingPressure,
        details.waterCapacity,
        details.currentGas,
        details.nitroxCompatible !== undefined ? (details.nitroxCompatible ? 1 : 0) : null,
        details.ownership,
        id
      ]
    )
  }
}
