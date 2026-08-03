import { createContext } from 'react';
import type { AcademicYear } from '@/features/academic/types/academic.types';

export interface AcademicContextValue {
  currentAcademicYear: AcademicYear | null;
  academicYears: AcademicYear[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const AcademicContext = createContext<AcademicContextValue | undefined>(undefined);
