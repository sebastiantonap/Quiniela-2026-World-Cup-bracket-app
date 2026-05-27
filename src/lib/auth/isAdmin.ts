export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.toLowerCase())
}
