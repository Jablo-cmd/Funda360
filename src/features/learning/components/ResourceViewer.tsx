import type { TeachingResourceRow } from '@/lib/database.types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AccessBadges } from '@/features/learning/components/ToolkitPanel';
import { altTextOf, parseBlocks, type ResourceBlock } from '@/features/learning/utils/toolkit';

function Block({ block }: { block: ResourceBlock }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="text-base font-semibold text-content-primary">{block.text}</h3>;
    case 'paragraph':
      return (
        <p className="break-words text-sm leading-relaxed text-content-primary">{block.text}</p>
      );
    case 'tip':
      return (
        <p className="rounded-md border-l-4 border-accent-500 bg-surface-sunken px-3 py-2 text-sm text-content-primary">
          <strong>Tip: </strong>
          {block.text}
        </p>
      );
    case 'steps':
      return (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-content-primary">
          {block.items.map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
        </ol>
      );
    case 'numbered':
      return (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-content-primary">
          {block.items.map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[16rem] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-surface-sunken">
                {block.headers.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-border px-3 py-2 font-semibold text-content-primary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {block.headers.map((h, c) => (
                    <td
                      key={h}
                      className="h-9 border-b border-border px-3 py-2 text-content-primary"
                    >
                      {row[c] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export interface ResourceViewerProps {
  resource: TeachingResourceRow | null;
  onClose: () => void;
}

/** Shows one toolkit resource. Content is rendered from a whitelist of block types, so it can never inject markup. */
export function ResourceViewer({ resource, onClose }: ResourceViewerProps) {
  const blocks = resource ? parseBlocks(resource.body) : [];
  const alt = resource ? altTextOf(resource.body) : null;
  return (
    <Modal
      isOpen={resource !== null}
      onClose={onClose}
      title={resource?.title ?? ''}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {resource?.printable && (
            <div className="sm:w-auto sm:min-w-[8rem]">
              <Button type="button" variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          )}
          <div className="sm:w-auto sm:min-w-[8rem]">
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      {resource && (
        <div className="flex flex-col gap-3" data-print-area>
          {resource.summary && <p className="text-sm text-content-secondary">{resource.summary}</p>}
          <AccessBadges resource={resource} />
          {blocks.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              This resource has no written content yet.
            </p>
          ) : (
            blocks.map((block, index) => <Block key={index} block={block} />)
          )}
          {alt && <p className="text-xs text-content-tertiary">Picture description: {alt}</p>}
        </div>
      )}
    </Modal>
  );
}
