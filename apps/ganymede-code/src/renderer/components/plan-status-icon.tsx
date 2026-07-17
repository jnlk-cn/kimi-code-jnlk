import type { ReactNode } from 'react';
import { Check, Circle, LoaderCircle } from 'lucide-react';

/** Status chip icons for compact summaries outside PlanBoxView. */
export function PlanStatusIcon(props: {
  readonly tone: 'approved' | 'rejected' | 'pending';
}): ReactNode {
  if (props.tone === 'approved') return <Check size={12} />;
  if (props.tone === 'rejected') return <Circle size={12} />;
  return <LoaderCircle className="spin" size={12} />;
}
