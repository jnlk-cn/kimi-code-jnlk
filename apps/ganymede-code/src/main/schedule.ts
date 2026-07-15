import { RRule } from 'rrule';

export function nextOccurrence(schedule: string, after: number): number {
  const trimmed = schedule.trim();
  const interval = /^every:(\d+)(s|m|h|d)$/.exec(trimmed);
  if (interval?.[1] !== undefined && interval[2] !== undefined) {
    const amount = Number(interval[1]);
    const multiplier =
      interval[2] === 's'
        ? 1_000
        : interval[2] === 'm'
          ? 60_000
          : interval[2] === 'h'
            ? 3_600_000
            : 86_400_000;
    return after + amount * multiplier;
  }
  if (trimmed.startsWith('RRULE:') || trimmed.includes('FREQ=')) {
    const rule = RRule.fromString(trimmed.replace(/^RRULE:/, ''));
    return rule.after(new Date(after), false)?.getTime() ?? Number.POSITIVE_INFINITY;
  }
  const oneTime = Date.parse(trimmed);
  return Number.isFinite(oneTime) && oneTime > after ? oneTime : Number.POSITIVE_INFINITY;
}
