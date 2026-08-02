import { createContext } from 'react';
import type { School } from '@/types/school.types';
import type {
  SchoolProfileUpdateInput,
  SchoolSettingsUpdateInput,
} from '@/features/school/types/school.types';

export interface SchoolContextValue {
  school: School | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSchool: (updates: SchoolProfileUpdateInput) => Promise<void>;
  updateSchoolSettings: (updates: SchoolSettingsUpdateInput) => Promise<void>;
}

export const SchoolContext = createContext<SchoolContextValue | undefined>(undefined);
