import { parseModel, type CustodyModel, type Issue } from '@llave-inglesa/domain';
import { useMemo } from 'react';

/** Validación completa (esquema + integridad) del modelo en edición. */
export function useValidation(model: CustodyModel): { valid: boolean; issues: Issue[] } {
  return useMemo(() => {
    const result = parseModel(model);
    return result.ok ? { valid: true, issues: result.warnings } : { valid: false, issues: result.issues };
  }, [model]);
}
