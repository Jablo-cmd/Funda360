import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toast/useToast';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { curriculumErrorMessage } from '@/features/learning/utils/errors';
import { contentStudioService } from '@/features/content-studio/services/contentStudioService';
import type { ContentEntityTable, ContentStatus } from '@/lib/database.types';
import { UNIT_LABEL } from '@/features/content-studio/utils/studio';
import { OriginBadge, StatusBadge } from '@/features/content-studio/components/StudioBits';
import {
  ChecksSection,
  ContentSection,
  ProvenanceSection,
  SourcesSection,
  VerificationSection,
  WorkflowSection,
} from '@/features/content-studio/components/ReviewSections';

export interface ReviewTarget {
  table: ContentEntityTable;
  id: string;
  title: string;
}

/** One place to read a unit, see where it came from, run the checks, link sources, verify it and move it through review. */
export function ReviewModal({
  target,
  onClose,
  onChanged,
}: {
  target: ReviewTarget | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [rev, setRev] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const review = useLoad(
    () => contentStudioService.loadReview(target!.table, target!.id),
    `review:${target?.table}:${target?.id}:${rev}`,
    target !== null,
  );

  async function run(label: string, action: () => Promise<void>, success: string) {
    setBusy(label);
    setActionError(null);
    try {
      await action();
      showToast(success, { variant: 'success' });
      setRev((r) => r + 1);
      onChanged();
    } catch (err) {
      setActionError(curriculumErrorMessage(err, 'That did not work. Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  const data = review.data;
  const title = data
    ? data.content.kind === 'lessons'
      ? data.content.lesson.title
      : data.content.kind === 'teaching_resources'
        ? data.content.resource.title
        : data.content.assessment.title
    : (target?.title ?? '');

  return (
    <Modal
      isOpen={target !== null}
      onClose={() => {
        setActionError(null);
        onClose();
      }}
      title={`${target ? UNIT_LABEL[target.table] : ''}: ${title}`}
      footer={
        <div className="sm:ml-auto sm:w-auto sm:min-w-[8rem]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {target && (
        <div className="flex min-w-0 flex-col gap-4">
          <ErrorAlert message={review.error ?? actionError} />
          {review.isLoading && !data ? (
            <LoadingBlock label="Loading…" />
          ) : data ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={data.provenance.status as ContentStatus} />
                <OriginBadge origin={data.provenance.origin} />
              </div>
              <ContentSection content={data.content} ai={data.provenance.origin === 'ai_draft'} />
              <ProvenanceSection data={data} />
              <ChecksSection
                data={data}
                busy={busy}
                onValidate={() =>
                  void run(
                    'validate',
                    () => contentStudioService.validate(target.table, target.id),
                    'Checks finished.',
                  )
                }
                onAcknowledge={(id, note) =>
                  void run(
                    `ack:${id}`,
                    () => contentStudioService.acknowledge(id, note),
                    'Warning acknowledged.',
                  )
                }
              />
              <SourcesSection
                data={data}
                busy={busy}
                onAdd={(sourceId, locator, supports) =>
                  void run(
                    'add',
                    () =>
                      contentStudioService.addReference(
                        target.table,
                        target.id,
                        sourceId,
                        locator,
                        supports,
                      ),
                    'Reference added.',
                  )
                }
                onCheck={(id, result) =>
                  void run(
                    `check:${id}`,
                    () => contentStudioService.checkReference(id, result, ''),
                    'Check saved.',
                  )
                }
              />
              <VerificationSection
                data={data}
                busy={busy}
                onSave={(status, note) =>
                  void run(
                    'verify',
                    () =>
                      contentStudioService.setVerification(target.table, target.id, status, note),
                    'Verification saved.',
                  )
                }
              />
              <WorkflowSection
                status={data.provenance.status}
                busy={busy}
                onMove={(to, note) =>
                  void run(
                    `move:${to}`,
                    () => contentStudioService.transition(target.table, target.id, to, note),
                    'Moved to the next step.',
                  )
                }
              />
            </>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
