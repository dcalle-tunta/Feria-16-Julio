import { BadRequestException, type ValidationPipeOptions } from '@nestjs/common';
import {
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
  type ApiFieldError,
} from '../http/api-error.response';

type PipeValidationError = Parameters<
  NonNullable<ValidationPipeOptions['exceptionFactory']>
>[0][number];

export function validationExceptionFactory(
  errors: PipeValidationError[],
): BadRequestException {
  return new BadRequestException({
    error: VALIDATION_ERROR_CODE,
    message: VALIDATION_ERROR_MESSAGE,
    details: flattenValidationErrors(errors),
  });
}

export function flattenValidationErrors(
  errors: readonly PipeValidationError[],
  parentPath = '',
): ApiFieldError[] {
  const details: ApiFieldError[] = [];

  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const constraints = error.constraints ?? {};

    for (const [constraint, message] of Object.entries(constraints)) {
      details.push({
        field,
        message:
          constraint === 'whitelistValidation'
            ? 'Este campo no está permitido.'
            : message,
      });
    }

    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}
