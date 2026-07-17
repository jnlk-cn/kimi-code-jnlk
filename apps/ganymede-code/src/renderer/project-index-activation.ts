import type {
  DesktopApi,
  IndexRiskAssessment,
  IndexStatus,
} from '../shared/contracts';

export type IndexActivationOutcome =
  | { readonly kind: 'activated'; readonly status: IndexStatus }
  | {
      readonly kind: 'needs_confirmation';
      readonly assessment: IndexRiskAssessment;
      readonly workDir: string;
      readonly additionalDirs: readonly string[];
    }
  | { readonly kind: 'skipped' };

export async function prepareProjectIndexActivation(
  api: DesktopApi,
  workDir: string,
  additionalDirs: readonly string[] = [],
): Promise<IndexActivationOutcome> {
  const assessment = await api.assessProjectIndex(workDir, additionalDirs);
  if (assessment === undefined) return { kind: 'skipped' };
  if (assessment.kind === 'none') {
    const status = await api.activateProjectIndex(workDir, additionalDirs);
    return { kind: 'activated', status };
  }
  // Mark blocked in the main process so status/badge show "待确认".
  await api.activateProjectIndex(workDir, additionalDirs).catch(() => undefined);
  return {
    kind: 'needs_confirmation',
    assessment,
    workDir,
    additionalDirs,
  };
}

export async function forceActivateProjectIndex(
  api: DesktopApi,
  workDir: string,
  additionalDirs: readonly string[] = [],
): Promise<IndexStatus> {
  return api.activateProjectIndex(workDir, additionalDirs, { force: true });
}

export async function optOutProjectIndex(
  api: DesktopApi,
  workDir: string,
  currentOptOut: readonly string[],
): Promise<void> {
  const roots = new Set(currentOptOut);
  roots.add(workDir);
  await api.setSettings({ indexOptOutRoots: [...roots] });
  await api.deactivateProjectIndex(workDir);
}
