'use client';

import type { ComponentProps } from 'react';
import { TimelinePanel } from '@/components/TimelinePanel';

export interface CaseTimelineProps extends ComponentProps<typeof TimelinePanel> {}

export function CaseTimeline(props: CaseTimelineProps) {
  return <TimelinePanel {...props} />;
}

export default CaseTimeline;
