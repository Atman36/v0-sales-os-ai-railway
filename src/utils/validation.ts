import { BadRequestException } from '@nestjs/common'
import { ZodError, ZodSchema } from 'zod'

export const parseOrThrow = <T>(schema: ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(error.flatten())
    }
    throw error
  }
}
