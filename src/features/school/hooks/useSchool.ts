import { useContext } from 'react';
import { SchoolContext } from '@/features/school/context/schoolContext';
import type { SchoolContextValue } from '@/features/school/context/schoolContext';

export function useSchool(): SchoolContextValue {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
}
