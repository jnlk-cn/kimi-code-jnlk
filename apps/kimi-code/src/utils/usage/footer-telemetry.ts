import {
  cacheHitPct,
  formatCny,
  isDeepSeekPeakHour,
  type FooterTelemetry,
} from '@moonshot-ai/kimi-code-sdk';
import { visibleWidth } from '@moonshot-ai/pi-tui';
import chalk from 'chalk';

import {
  FOOTER_LOW_BALANCE_CNY,
  FOOTER_TELEMETRY_SEPARATOR,
} from '#/tui/constant/footer-telemetry';
import { t, tFormat } from '#/tui/i18n';
import type { ColorPalette } from '#/tui/theme/colors';

import { formatTokenCount } from './usage-format';

export interface FooterTelemetrySegment {
  readonly text: string;
  readonly width: number;
  readonly priority: number;
}

/**
 * Billing segments for the footer's second line, cheapest to lose last:
 * cache hit rate, estimated DeepSeek spend (with the peak/off-peak marker),
 * account balance, and the session's token totals. Cost, balance, and the
 * peak marker only exist when the active model runs on DeepSeek.
 */
export function buildTelemetrySegments(
  telemetry: FooterTelemetry,
  colors: ColorPalette,
  nowMs: number = Date.now(),
): readonly FooterTelemetrySegment[] {
  const muted = chalk.hex(colors.textMuted);
  const plain = chalk.hex(colors.text);
  const warning = chalk.hex(colors.warning);
  const error = chalk.hex(colors.error);
  const segments: FooterTelemetrySegment[] = [];
  const push = (text: string, priority: number): void => {
    segments.push({ text, width: visibleWidth(text), priority });
  };

  const cachePct = cacheHitPct(telemetry.sessionCacheHit, telemetry.sessionCacheMiss);
  if (cachePct !== null) {
    push(muted(tFormat('cache {percent}%', { percent: cachePct })), 0);
  }

  const peak = isDeepSeekPeakHour(new Date(nowMs));
  const peakMarker = peak
    ? warning(`(${t('peak')})`)
    : muted(`(${t('off-peak')})`);
  if (telemetry.billingEnabled && telemetry.estimatedCostCny > 0) {
    const cost = tFormat('~{cost}', { cost: formatCny(telemetry.estimatedCostCny) });
    push(plain(cost) + ' ' + peakMarker, 1);
  } else if (telemetry.billingEnabled && peak) {
    push(peakMarker, 2);
  }

  if (telemetry.billingEnabled && telemetry.balanceCny !== null) {
    if (telemetry.balanceAvailable) {
      const balance = Number.parseFloat(telemetry.balanceCny);
      const label = tFormat('balance {amount}', { amount: formatBalanceCny(telemetry.balanceCny) });
      push((Number.isFinite(balance) && balance < FOOTER_LOW_BALANCE_CNY ? warning : muted)(label), 3);
    } else {
      push(error(t('balance insufficient')), 3);
    }
  }

  if (telemetry.sessionInput > 0 || telemetry.sessionOutput > 0) {
    push(
      muted(
        tFormat('session {input} in / {output} out', {
          input: formatTokenCount(telemetry.sessionInput),
          output: formatTokenCount(telemetry.sessionOutput),
        }),
      ),
      4,
    );
  }

  return segments;
}

/** Drop the least important segments until the line fits `maxWidth`. */
export function joinTelemetrySegments(
  segments: readonly FooterTelemetrySegment[],
  maxWidth: number,
): string {
  if (maxWidth <= 0 || segments.length === 0) return '';
  const separatorWidth = visibleWidth(FOOTER_TELEMETRY_SEPARATOR);
  const kept = segments.toSorted((a, b) => a.priority - b.priority);
  const totalWidth = (): number =>
    kept.reduce((sum, segment) => sum + segment.width, 0) + separatorWidth * (kept.length - 1);
  while (kept.length > 0 && totalWidth() > maxWidth) kept.pop();
  return kept.map((segment) => segment.text).join(FOOTER_TELEMETRY_SEPARATOR);
}

function formatBalanceCny(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('¥') ? trimmed : `¥${trimmed}`;
}
