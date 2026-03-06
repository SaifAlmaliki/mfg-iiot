import { db } from '@/lib/db';

type ElementInput = {
  props?: {
    bindings?: Array<{ tagId?: string }>;
    control?: { type?: string; tagId?: string };
  };
};

export async function validateElementsForWrite(
  elements: ElementInput[] | null | undefined
): Promise<{ error: string; details?: string } | null> {
  if (!elements || !Array.isArray(elements)) return null;

  const tagIds = new Set<string>();
  for (const el of elements) {
    const props = el.props;
    if (props?.bindings) {
      for (const b of props.bindings) {
        if (b?.tagId) tagIds.add(b.tagId);
      }
    }
    if (props?.control?.tagId) tagIds.add(props.control.tagId);
  }

  if (tagIds.size === 0) return null;

  const tags = await db.tag.findMany({
    where: { id: { in: Array.from(tagIds) } },
    select: { id: true, isWritable: true },
  });
  const tagMap = new Map(tags.map((t) => [t.id, t]));

  for (const el of elements) {
    const props = el.props;
    if (props?.bindings) {
      for (const b of props.bindings) {
        if (b?.tagId && !tagMap.has(b.tagId)) {
          return { error: 'Invalid tag in binding', details: `Tag ${b.tagId} not found` };
        }
      }
    }
    const control = props?.control;
    if (control?.tagId) {
      if (!tagMap.has(control.tagId)) {
        return { error: 'Invalid tag in control', details: `Tag ${control.tagId} not found` };
      }
      if ((control.type === 'setpoint' || control.type === 'button') && !tagMap.get(control.tagId)?.isWritable) {
        return { error: 'Tag is not writable', details: `Tag ${control.tagId} cannot be used for setpoint/button` };
      }
    }
  }
  return null;
}
