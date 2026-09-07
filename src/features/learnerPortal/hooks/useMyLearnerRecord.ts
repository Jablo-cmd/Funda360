import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/context/authContext';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface MyLearnerRecord {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  learnerNumber: string;
  status: string;
}

/**
 * The learner's own SIS record — `learners` where `profile_id = auth.uid()`
 * (the `learners_select` policy's own clause, unchanged since
 * learner_management). One row or none.
 */
export function useMyLearnerRecord(): { record: MyLearnerRecord | null; isLoading: boolean; error: string | null } {
  const { user } = useAuth();
  const [record, setRecord] = useState<MyLearnerRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('learners')
      .select('id, school_id, first_name, last_name, learner_number, status')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(getDbErrorMessage(err, 'Failed to load your record.'));
        } else if (data) {
          setRecord({
            id: data.id,
            schoolId: data.school_id,
            firstName: data.first_name,
            lastName: data.last_name,
            learnerNumber: data.learner_number,
            status: data.status,
          });
        }
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { record, isLoading, error };
}
