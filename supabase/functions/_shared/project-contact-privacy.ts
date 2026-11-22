export function withoutProjectClientContact(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null;
  const { client_phone: _phone, client_email: _email, client_portal_token: _token, ...safe } = row;
  return safe;
}