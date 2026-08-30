import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAdmissionsPipeline } from '@/features/learners/hooks/useAdmissionsPipeline';
import { AdmissionsPipelineBoard } from '@/features/learners/components/AdmissionsPipelineBoard';

export function AdmissionsPipelinePage() {
  const { can } = usePermissions();
  const canManage = can('learner.manage');
  const { school } = useSchool();
  const { columns, isLoading, error, moveLearner, refetch } = useAdmissionsPipeline(school?.id);

  return (
    <PageContainer>
      <PageHeader
        title="Admissions Pipeline"
        description="Track every enquiry from first contact through to enrollment."
      />

      <ErrorAlert message={error} />

      {!school ? (
        <NoActiveSchoolNotice resource="the admissions pipeline" />
      ) : isLoading ? (
        <LoadingBlock label="Loading admissions pipeline…" />
      ) : (
        <AdmissionsPipelineBoard
          columns={columns}
          canManage={canManage}
          onMove={moveLearner}
          onChanged={() => void refetch()}
        />
      )}
    </PageContainer>
  );
}
