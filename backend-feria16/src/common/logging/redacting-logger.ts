import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { redactForLog, redactSensitiveText, SENSITIVE_LOG_KEYS } from './redact-sensitive';

export class RedactingLogger extends ConsoleLogger {
  constructor() {
    super({
      redact: {
        paths: [...SENSITIVE_LOG_KEYS],
        censor: '[REDACTED]',
      },
    });
  }

  protected override printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
    params?: Record<string, any>,
  ): void {
    super.printMessages(
      messages.map((message) => redactForLog(message)),
      context,
      logLevel,
      writeStreamType,
      typeof errorStack === 'string'
        ? redactSensitiveText(errorStack)
        : errorStack,
      params,
    );
  }

  protected override printStackTrace(stack: string): void {
    if (!stack) {
      return;
    }

    super.printStackTrace(redactSensitiveText(stack));
  }
}
