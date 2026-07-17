import type { SessionStatusView } from '../shared/contracts';
import { resolveInteractionMode, type InteractionMode } from '../shared/contracts';

export function patchStatusFromEvent(
  status: SessionStatusView,
  event: Readonly<Record<string, unknown>>,
): SessionStatusView {
  const type = String(event['type'] ?? '');
  if (type === 'turn.started') {
    return status.running ? status : { ...status, running: true };
  }
  if (type === 'turn.ended' || type === 'error') {
    return status.running ? { ...status, running: false } : status;
  }
  if (type !== 'agent.status.updated') return status;

  const eventMode = asInteractionMode(event['interactionMode']);
  const planMode = typeof event['planMode'] === 'boolean' ? event['planMode'] : undefined;
  const swarmMode = typeof event['swarmMode'] === 'boolean' ? event['swarmMode'] : undefined;
  const askMode = typeof event['askMode'] === 'boolean' ? event['askMode'] : undefined;
  const debugMode = typeof event['debugMode'] === 'boolean' ? event['debugMode'] : undefined;
  const engineeringMode =
    typeof event['engineeringMode'] === 'boolean' ? event['engineeringMode'] : undefined;
  const hasModePatch =
    eventMode !== undefined ||
    planMode !== undefined ||
    swarmMode !== undefined ||
    askMode !== undefined ||
    debugMode !== undefined ||
    engineeringMode !== undefined;
  const interactionMode = hasModePatch
    ? resolveInteractionMode({
        interactionMode: eventMode,
        planMode: planMode ?? status.planMode,
        swarmMode: swarmMode ?? status.swarmMode,
        askMode: askMode ?? status.askMode,
        debugMode: debugMode ?? status.debugMode,
        engineeringMode: engineeringMode ?? status.engineeringMode,
      })
    : status.interactionMode;

  const next: SessionStatusView = {
    ...status,
    model: typeof event['model'] === 'string' ? event['model'] : status.model,
    permission:
      event['permission'] === 'manual' ||
      event['permission'] === 'auto' ||
      event['permission'] === 'yolo'
        ? event['permission']
        : status.permission,
    interactionMode,
    planMode: planMode ?? (hasModePatch ? interactionMode === 'plan' : status.planMode),
    planFilePath:
      typeof event['planFilePath'] === 'string' && event['planFilePath'].length > 0
        ? event['planFilePath']
        : planMode === false
          ? undefined
          : status.planFilePath,
    approvedPlanPath: status.approvedPlanPath,
    swarmMode: swarmMode ?? (hasModePatch ? interactionMode === 'multitask' : status.swarmMode),
    askMode: askMode ?? (hasModePatch ? interactionMode === 'ask' : status.askMode),
    debugMode: debugMode ?? (hasModePatch ? interactionMode === 'debug' : status.debugMode),
    engineeringMode:
      engineeringMode ??
      (hasModePatch ? interactionMode === 'engineering' : status.engineeringMode),
    contextTokens:
      typeof event['contextTokens'] === 'number' ? event['contextTokens'] : status.contextTokens,
    maxContextTokens:
      typeof event['maxContextTokens'] === 'number'
        ? event['maxContextTokens']
        : status.maxContextTokens,
  };

  return statusEqual(status, next) ? status : next;
}

function asInteractionMode(value: unknown): InteractionMode | undefined {
  return value === 'agent' ||
    value === 'plan' ||
    value === 'debug' ||
    value === 'multitask' ||
    value === 'ask' ||
    value === 'engineering'
    ? value
    : undefined;
}

function statusEqual(left: SessionStatusView, right: SessionStatusView): boolean {
  const leftRecord = left as unknown as Record<string, unknown>;
  const rightRecord = right as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  for (const key of keys) {
    if (leftRecord[key] !== rightRecord[key]) return false;
  }
  return true;
}

