import { ColumnOptions } from 'typeorm';

export const createdAtColumn = {
  type: 'timestamp',
  default: () => 'CURRENT_TIMESTAMP',
} as const satisfies ColumnOptions;

export const updatedAtColumn = {
  type: 'timestamp',
  default: () => 'CURRENT_TIMESTAMP',
  onUpdate: 'CURRENT_TIMESTAMP',
} as const satisfies ColumnOptions;
