import { randomUUID } from 'node:crypto';

import type { ActivateSkillPayload } from '#/rpc';
import type { ContentPart } from '@moonshot-ai/kosong';

import type { Agent } from '..';
import { ErrorCodes, KimiError } from '#/errors';
import { isUserActivatableSkillType } from '../../skill';
import type { SkillActivationOrigin } from '../context';
import { renderBootstrapSkillPrompt, renderUserSlashSkillPrompt } from './prompt';
import type { SkillRegistry } from './types';

export type { SkillRegistry } from './types';

export class SkillManager {
  constructor(
    protected readonly agent: Agent,
    public readonly registry: SkillRegistry,
  ) {}

  activate(input: ActivateSkillPayload): void {
    const skill = this.registry.getSkill(input.name);
    if (skill === undefined) {
      throw new KimiError(ErrorCodes.SKILL_NOT_FOUND, `Skill "${input.name}" was not found`);
    }
    if (!isUserActivatableSkillType(skill.metadata.type)) {
      throw new KimiError(ErrorCodes.SKILL_TYPE_UNSUPPORTED, `Skill "${skill.name}" cannot be activated by the user`);
    }

    const skillArgs = input.args ?? '';
    const skillContent = this.registry.renderSkillPrompt(skill, skillArgs);
    const wrapped = [
      {
        type: 'text' as const,
        text: renderUserSlashSkillPrompt({
          skillName: skill.name,
          skillArgs,
          skillContent,
          skillSource: skill.source,
          skillDir: skill.dir,
        }),
      },
    ];

    this.recordActivation(
      {
        kind: 'skill_activation',
        activationId: randomUUID(),
        skillName: skill.name,
        trigger: 'user-slash',
        skillType: skill.metadata.type,
        skillPath: skill.path,
        skillSource: skill.source,
        skillArgs: input.args,
      },
      wrapped,
    );
  }

  /**
   * Silently preload a skill into context without launching a turn.
   * Used by engineering-mode bootstrap so mode switch does not busy the agent.
   */
  bootstrap(input: ActivateSkillPayload): void {
    const skill = this.registry.getSkill(input.name);
    if (skill === undefined) {
      throw new KimiError(ErrorCodes.SKILL_NOT_FOUND, `Skill "${input.name}" was not found`);
    }
    if (!isUserActivatableSkillType(skill.metadata.type)) {
      throw new KimiError(ErrorCodes.SKILL_TYPE_UNSUPPORTED, `Skill "${skill.name}" cannot be activated by the user`);
    }

    const skillArgs = input.args ?? '';
    const skillContent = this.registry.renderSkillPrompt(skill, skillArgs);
    const origin: SkillActivationOrigin = {
      kind: 'skill_activation',
      activationId: randomUUID(),
      skillName: skill.name,
      trigger: 'engineering-bootstrap',
      skillType: skill.metadata.type,
      skillPath: skill.path,
      skillSource: skill.source,
      skillArgs: input.args,
    };
    const text = renderBootstrapSkillPrompt({
      skillName: skill.name,
      skillArgs,
      skillContent,
      skillSource: skill.source,
      skillDir: skill.dir,
    });

    this.emitActivation(origin);
    this.agent.context.appendUserMessage([{ type: 'text', text }], origin);
  }

  recordActivation(
    origin: SkillActivationOrigin,
    input?: readonly ContentPart[] | undefined,
  ): void {
    this.emitActivation(origin);
    if (input !== undefined) {
      this.agent.turn.prompt(input, origin);
    }
  }

  private emitActivation(origin: SkillActivationOrigin): void {
    this.agent.emitEvent({
      type: 'skill.activated',
      activationId: origin.activationId,
      skillName: origin.skillName,
      trigger: origin.trigger,
      skillArgs: origin.skillArgs,
      skillPath: origin.skillPath,
      skillSource: origin.skillSource,
    });
    this.agent.telemetry.track('skill_invoked', {
      skill_name: origin.skillName,
      trigger: origin.trigger,
    });
    if (origin.skillType === 'flow') {
      this.agent.telemetry.track('flow_invoked', {
        flow_name: origin.skillName,
      });
    }
  }
}
