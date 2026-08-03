import { useContext } from 'react';
import { AcademicContext } from '@/features/academic/context/academicContext';
import type { AcademicContextValue } from '@/features/academic/context/academicContext';

export function useAcademic(): AcademicContextValue {
  const context = useContext(AcademicContext);
  if (!context) {
    throw new Error('useAcademic must be used within an AcademicProvider');
  }
  return context;
}
