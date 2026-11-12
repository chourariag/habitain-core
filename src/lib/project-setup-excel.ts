export interface SetupSheetRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface ProjectSetupWorkbookRows {
  schedule: SetupSheetRow[];
  boq: SetupSheetRow[];
  materials: SetupSheetRow[];
}

export interface PreparedProjectSetupRows {
  schedule: Array<{
    task_code: string;
    task_name: string;
    planned_start: string | null;
    planned_end: string | null;
    responsible_role: string | null;
  }>;
  boq: Array<{
    sno: number;
    item_description: string;
    unit: string;
    boq_qty: number;
    boq_rate: number;
    category: string;
    task_code: string;
    excel_row: number;
  }>;
  materials: Array<{
    material_description: string;
    unit: string;
    planned_qty: number;
    planned_po_release_date: string | null;
    planned_delivery_date: string | null;
    section: string;
    task_code: string;
    excel_row: number;
  }>;
}

export interface SetupValidationResult {
  prepared: PreparedProjectSetupRows;
  errors: string[];
}

const text = (value: unknown) => String(value ?? "").trim();
const codeKey = (value: string) => value.trim();
const duplicateCodeKey = (value: string) => value.trim().toLocaleLowerCase();
const isExampleRow = (values: Record<string, unknown>) =>
  text(values.task_code) === "__TEMPLATE_EXAMPLE__" ||
  Object.values(values).some((value) => text(value).toLocaleLowerCase().startsWith("example row"));

export function parseDDMMYYYY(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  const match = text(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: unknown, label: string, sheet: string, row: number, errors: string[]) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseDDMMYYYY(value);
  if (!parsed) errors.push(`${sheet} row ${row}: ${label} must be a valid DD/MM/YYYY date.`);
  return parsed;
}

export function validateProjectSetupRows(
  rows: ProjectSetupWorkbookRows,
  existingTaskCodes: string[],
): SetupValidationResult {
  const errors: string[] = [];
  const prepared: PreparedProjectSetupRows = { schedule: [], boq: [], materials: [] };
  const scheduleCodes = new Set<string>();
  const availableCodes = new Set(existingTaskCodes.map(codeKey).filter(Boolean));

  for (const row of rows.schedule) {
    const values = row.values;
    if (isExampleRow(values)) {
      errors.push(`Schedule row ${row.rowNumber}: remove the example row before upload.`);
      continue;
    }
    const taskCode = text(values.task_code);
    const taskName = text(values.task_name);
    if (!taskCode) errors.push(`Schedule row ${row.rowNumber}: task_code is required.`);
    else if (scheduleCodes.has(duplicateCodeKey(taskCode))) errors.push(`Schedule row ${row.rowNumber}: duplicate task_code “${taskCode}”.`);
    else scheduleCodes.add(duplicateCodeKey(taskCode));
    if (!taskName) errors.push(`Schedule row ${row.rowNumber}: task_name is required.`);
    const start = parseOptionalDate(values.planned_start, "planned_start", "Schedule", row.rowNumber, errors);
    const end = parseOptionalDate(values.planned_end, "planned_end", "Schedule", row.rowNumber, errors);
    if (start && end && end < start) errors.push(`Schedule row ${row.rowNumber}: planned_end cannot be before planned_start.`);
    if (taskCode && taskName) {
      availableCodes.add(codeKey(taskCode));
      prepared.schedule.push({
        task_code: taskCode,
        task_name: taskName,
        planned_start: start,
        planned_end: end,
        responsible_role: text(values.responsible_role) || null,
      });
    }
  }

  const seenSno = new Set<number>();
  for (const row of rows.boq) {
    const values = row.values;
    if (isExampleRow(values)) {
      errors.push(`BOQ row ${row.rowNumber}: remove the example row before upload.`);
      continue;
    }
    const taskCode = text(values.task_code);
    const snoValue = parseNumber(values.sno);
    const description = text(values.item_description);
    const unit = text(values.unit);
    const quantity = parseNumber(values.boq_qty);
    const rate = parseNumber(values.boq_rate);
    if (!taskCode) errors.push(`BOQ row ${row.rowNumber}: task_code is required.`);
    else if (!availableCodes.has(codeKey(taskCode))) errors.push(`BOQ row ${row.rowNumber}: task_code “${taskCode}” is not in this file’s Schedule sheet or this project’s existing tasks.`);
    if (snoValue === null || !Number.isInteger(snoValue) || snoValue < 1) errors.push(`BOQ row ${row.rowNumber}: sno must be a positive whole number.`);
    else if (seenSno.has(snoValue)) errors.push(`BOQ row ${row.rowNumber}: duplicate sno ${snoValue}.`);
    else seenSno.add(snoValue);
    if (!description) errors.push(`BOQ row ${row.rowNumber}: item_description is required.`);
    if (!unit) errors.push(`BOQ row ${row.rowNumber}: unit is required.`);
    if (quantity === null) errors.push(`BOQ row ${row.rowNumber}: boq_qty must be numeric.`);
    if (rate === null) errors.push(`BOQ row ${row.rowNumber}: boq_rate must be numeric.`);
    if (taskCode && snoValue !== null && Number.isInteger(snoValue) && snoValue > 0 && description && unit && quantity !== null && rate !== null) {
      prepared.boq.push({
        sno: snoValue,
        item_description: description,
        unit,
        boq_qty: quantity,
        boq_rate: rate,
        category: text(values.category),
        task_code: taskCode,
        excel_row: row.rowNumber,
      });
    }
  }

  const seenMaterials = new Set<string>();
  for (const row of rows.materials) {
    const values = row.values;
    if (isExampleRow(values)) {
      errors.push(`Material Plan row ${row.rowNumber}: remove the example row before upload.`);
      continue;
    }
    const taskCode = text(values.task_code);
    const description = text(values.material_description);
    const unit = text(values.unit);
    const quantity = parseNumber(values.planned_qty);
    const releaseDate = parseOptionalDate(values.planned_po_release_date, "planned_po_release_date", "Material Plan", row.rowNumber, errors);
    const deliveryDate = parseOptionalDate(values.planned_delivery_date, "planned_delivery_date", "Material Plan", row.rowNumber, errors);
    if (taskCode && !availableCodes.has(codeKey(taskCode))) errors.push(`Material Plan row ${row.rowNumber}: task_code “${taskCode}” is not in this file’s Schedule sheet or this project’s existing tasks.`);
    if (!description) errors.push(`Material Plan row ${row.rowNumber}: material_description is required.`);
    if (!unit) errors.push(`Material Plan row ${row.rowNumber}: unit is required.`);
    if (quantity === null) errors.push(`Material Plan row ${row.rowNumber}: planned_qty must be numeric.`);
    if (releaseDate && deliveryDate && deliveryDate < releaseDate) errors.push(`Material Plan row ${row.rowNumber}: planned_delivery_date cannot be before planned_po_release_date.`);
    const identity = `${codeKey(taskCode)}|${description.toLocaleLowerCase()}`;
    if (seenMaterials.has(identity)) errors.push(`Material Plan row ${row.rowNumber}: duplicate task_code and material_description.`);
    else seenMaterials.add(identity);
    if (description && unit && quantity !== null) {
      prepared.materials.push({
        material_description: description,
        unit,
        planned_qty: quantity,
        planned_po_release_date: releaseDate,
        planned_delivery_date: deliveryDate,
        section: text(values.section),
        task_code: taskCode,
        excel_row: row.rowNumber,
      });
    }
  }

  return { prepared, errors };
}