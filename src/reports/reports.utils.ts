export const reportDateRegex = /^\d{4}-\d{2}-\d{2}$/

export function parseReportDate(date: string) {
  if (!reportDateRegex.test(date)) {
    throw new Error('Invalid date')
  }

  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('Invalid date')
  }

  return parsed
}

export function formatReportDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
