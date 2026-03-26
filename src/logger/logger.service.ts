import { Injectable, LoggerService } from '@nestjs/common'
import pino from 'pino'

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
  })

  log(message: any, ...optionalParams: any[]) {
    this.write('info', message, optionalParams)
  }

  error(message: any, ...optionalParams: any[]) {
    this.write('error', message, optionalParams)
  }

  warn(message: any, ...optionalParams: any[]) {
    this.write('warn', message, optionalParams)
  }

  debug(message: any, ...optionalParams: any[]) {
    this.write('debug', message, optionalParams)
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.write('trace', message, optionalParams)
  }

  private write(level: 'info' | 'error' | 'warn' | 'debug' | 'trace', message: any, optionalParams: any[]) {
    const context = optionalParams?.[0]
    if (typeof message === 'object') {
      this.logger[level]({ ...message, context })
      return
    }
    this.logger[level]({ msg: message, context })
  }
}
