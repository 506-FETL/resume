import { ExperienceRequestError } from './input.ts'

export function fail(code: string, message: string, status = 400): never {
  throw new ExperienceRequestError(code, message, status)
}
