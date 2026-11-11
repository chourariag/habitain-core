export function hasRequiredAttendanceLocation(latitude: number | null, longitude: number | null): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}