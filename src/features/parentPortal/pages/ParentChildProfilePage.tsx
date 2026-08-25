import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { FullScreenNotice } from '@/components/ui/FullScreenNotice';
import { useLearner } from '@/features/learners/hooks/useLearner';
import { ChildOverviewTab } from '@/features/parentPortal/components/ChildOverviewTab';
import { ChildAttendanceTab } from '@/features/parentPortal/components/ChildAttendanceTab';
import { ChildAcademicsTab } from '@/features/parentPortal/components/ChildAcademicsTab';
import { ChildFeesTab } from '@/features/parentPortal/components/ChildFeesTab';
import { ChildBehaviourTab } from '@/features/parentPortal/components/ChildBehaviourTab';

type TabKey = 'overview' | 'attendance' | 'academics' | 'fees' | 'behaviour';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'academics', label: 'Academics' },
  { key: 'fees', label: 'Fees' },
  { key: 'behaviour', label: 'Behaviour' },
];

/**
 * useLearner() queries `learners` by id with no client-side ownership
 * check — RLS (learners_select's is_learner_guardian(id) clause) is what
 * actually decides whether this row comes back at all. A guardian
 * manually editing the URL to another family's learner id gets exactly
 * the same "not found" state as a genuinely bad id — there is no
 * distinguishable "forbidden" response to leak that the id exists. This
 * is the real enforcement Phase 8 requires; the route itself does not
 * additionally check "is this learner one of mine" because it doesn't
 * need to and couldn't do so more strongly than RLS already does.
 */
export function ParentChildProfilePage() {
  const { learnerId } = useParams<{ learnerId: string }>();
  const navigate = useNavigate();
  const { learner, isLoading, error } = useLearner(learnerId);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  if (isLoading) {
    return <FullScreenSpinner label="Loading…" />;
  }

  if (error) {
    return <FullScreenNotice title="Something went wrong" message={error} />;
  }

  if (!learner) {
    return (
      <FullScreenNotice
        title="Not found"
        message="This learner isn't linked to your account, or doesn't exist."
        action={
          <Link to="/parent/children" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline">
            Back to My Children
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/parent/children')}
        className="focus-ring self-start rounded text-sm font-medium text-content-secondary hover:text-content-primary"
      >
        ← Back to My Children
      </button>

      <div>
        <h1 className="text-2xl font-bold text-content-primary">
          {learner.firstName} {learner.lastName}
        </h1>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={`focus-ring rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-300'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <ChildOverviewTab learner={learner} />}
      {activeTab === 'attendance' && <ChildAttendanceTab learnerId={learner.id} />}
      {activeTab === 'academics' && <ChildAcademicsTab learnerId={learner.id} />}
      {activeTab === 'fees' && <ChildFeesTab learnerId={learner.id} />}
      {activeTab === 'behaviour' && <ChildBehaviourTab />}
    </div>
  );
}
