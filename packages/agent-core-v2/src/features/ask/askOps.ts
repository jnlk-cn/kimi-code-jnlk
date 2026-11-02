/* oxlint-disable typescript-eslint/no-unsafe-declaration-merging, eslint-plugin-import/namespace -- Event2 class+payload-interface declaration merging is the sanctioned event-declaration idiom. */
import { z } from 'zod';

import { AgentStatusUpdated } from '#/agent/usage/usageEvents';
import { AgentEvent2 } from '#/app/event/event2';
import { MAIN_AGENT_ID } from '#/session/agentLifecycle/agentLifecycle';
import { defineState } from '#/state/state';

export interface AskModeState {
  readonly active: boolean;
}

const askModeEnterSchema = z.object({ agentId: z.string() });

export class AskModeEnter extends AgentEvent2<z.infer<typeof askModeEnterSchema>> {
  static override readonly type = 'ask_mode.enter';
  static override readonly durable = true;
  static override readonly schema = askModeEnterSchema;
}
export interface AskModeEnter {
  readonly agentId: string;
}

const askModeExitSchema = z.object({ agentId: z.string() });

export class AskModeExit extends AgentEvent2<z.infer<typeof askModeExitSchema>> {
  static override readonly type = 'ask_mode.exit';
  static override readonly durable = true;
  static override readonly schema = askModeExitSchema;
}
export interface AskModeExit {
  readonly agentId: string;
}

export const askKey = defineState('ask', (): AskModeState => ({ active: false }))
  .replayable({ schema: z.custom<AskModeState>() })
  .undoable()
  .on(AskModeEnter, (s, e, ctx) => {
    if (e.agentId !== MAIN_AGENT_ID) return;
    s.active = true;
    ctx.emit(new AgentStatusUpdated({ agentId: e.agentId, askMode: true }));
  })
  .on(AskModeExit, (s, e, ctx) => {
    if (s.active) s.active = false;
    ctx.emit(new AgentStatusUpdated({ agentId: e.agentId, askMode: false }));
  });
