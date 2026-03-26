import { z } from 'zod'

export const MAX_COUNT_VALUE = 1_000_000
export const MAX_MONEY_VALUE = 9_999_999_999.99

export const countMetricSchema = z.number().finite().min(0).max(MAX_COUNT_VALUE)
export const moneyMetricSchema = z.number().finite().min(0).max(MAX_MONEY_VALUE)
