export function isAllowedCallback(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    return (
      host === 'github.com' ||
      host.endsWith('.github.com') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    )
  } catch {
    return false
  }
}
