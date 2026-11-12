export type LabourMasterImportRow = {
  worker_code: string;
  name: string;
  contractor: string;
  skill_type: string;
  hourly_rate: number | null;
  monthly_salary: number | null;
  status: string;
};

export type LabourMasterExcelRow = {
  rowNumber: number;
  values: Record<string, unknown>;
};

export type LabourMasterValidation = {
  prepared: LabourMasterImportRow[];
  errors: string[];
};

const MASTER_COLUMNS = [
  "worker_code",
  "name",
  "contractor",
  "skill_type",
  "hourly_rate",
  "monthly_salary",
  "status",
] as const;

function textValue(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function numericValue(value: unknown): number | null | "invalid" {
  const text = textValue(value);
  if (!text) return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : "invalid";
}

export function rowsFromLabourMasterSheet(rows: unknown[][]): LabourMasterExcelRow[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => textValue(header).toLowerCase());
  return rows.slice(1).flatMap((row, index) => {
    const values = Object.fromEntries(headers.map((header, col) => [header, row[col]]));
    if (MASTER_COLUMNS.every((column) => !textValue(values[column]))) return [];
    return [{ rowNumber: index + 2, values }];
  });
}

export function validateLabourMasterRows(
  rows: LabourMasterExcelRow[],
  existingWorkers: Array<{ worker_code: string | null; name: string }>,
  contractorNames: string[],
): LabourMasterValidation {
  const errors: string[] = [];
  const prepared: LabourMasterImportRow[] = [];
  const seenCodes = new Set<string>();
  const knownWorkers = new Map<string, string>();
  existingWorkers.forEach((worker) => {
    if (worker.worker_code) knownWorkers.set(worker.worker_code.toLowerCase(), worker.name);
  });
  const knownContractors = new Set(contractorNames.map((name) => name.trim().toLowerCase()));

  for (const row of rows) {
    const { values } = row;
    const workerCode = textValue(values.worker_code);
    const name = textValue(values.name);
    const contractor = textValue(values.contractor);
    const skillType = textValue(values.skill_type);
    const status = textValue(values.status) || "active";
    const line = row.rowNumber;

    if (workerCode === "__TEMPLATE_EXAMPLE__" || name === "Example worker — replace or remove") {
      errors.push(`Row ${line}: remove the example row before upload.`);
      continue;
    }
    if (!name) errors.push(`Row ${line}: name is required.`);
    if (!skillType) errors.push(`Row ${line}: skill_type is required.`);
    if (contractor && !knownContractors.has(contractor.toLowerCase())) {
      errors.push(`Row ${line}: contractor “${contractor}” was not found in the contractor list.`);
    }
    if (!new Set(["active", "on_leave", "inactive"]).has(status)) {
      errors.push(`Row ${line}: status must be active, on_leave, or inactive.`);
    }

    if (workerCode) {
      const normalizedCode = workerCode.toLowerCase();
      if (seenCodes.has(normalizedCode)) errors.push(`Row ${line}: duplicate worker_code “${workerCode}”.`);
      seenCodes.add(normalizedCode);
      const existingName = knownWorkers.get(normalizedCode);
      if (existingName && existingName !== name) {
        errors.push(`Row ${line}: worker name cannot be changed for code “${workerCode}”.`);
      }
    }

    const hourlyRate = numericValue(values.hourly_rate);
    const monthlySalary = numericValue(values.monthly_salary);
    if (hourlyRate === "invalid") errors.push(`Row ${line}: hourly_rate must be numeric.`);
    if (monthlySalary === "invalid") errors.push(`Row ${line}: monthly_salary must be numeric.`);
    if (typeof hourlyRate === "number" && hourlyRate < 0) errors.push(`Row ${line}: hourly_rate cannot be negative.`);
    if (typeof monthlySalary === "number" && monthlySalary < 0) errors.push(`Row ${line}: monthly_salary cannot be negative.`);

    if (
      name && skillType &&
      hourlyRate !== "invalid" &&
      monthlySalary !== "invalid" &&
      !errors.some((error) => error.startsWith(`Row ${line}:`))
    ) {
      prepared.push({
        worker_code: workerCode,
        name,
        contractor,
        skill_type: skillType,
        hourly_rate: hourlyRate,
        monthly_salary: monthlySalary,
        status,
      });
    }
  }

  return { prepared, errors };
}