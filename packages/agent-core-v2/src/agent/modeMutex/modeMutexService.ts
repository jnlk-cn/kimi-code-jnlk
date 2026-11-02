import { Disposable } from '#/_base/di/lifecycle';
import { ScopeActivation, registerScopedService } from '#/_base/di/scope';
import { IAgentStateService } from '#/agent/state/agentState';
import { AgentStatusUpdated } from '#/agent/usage/usageEvents';
import { IEventBus } from '#/app/event/eventBus';
import { LifecycleScope } from '#/app/scopes';
import { IAgentAskModeService } from '#/features/ask/ask';
import { AskModeEnter } from '#/features/ask/askOps';
import { IAgentDebugModeService } from '#/features/debug/debug';
import { DebugModeEnter } from '#/features/debug/debugOps';
import { GoalUpdated } from '#/features/goal/goalOps';
import { IAgentGoalService } from '#/features/goal/goalService';
import { IAgentPlanService } from '#/features/plan/plan';
import { PlanModeEnter, planKey } from '#/features/plan/planOps';
import { IAgentSwarmService } from '#/features/swarm/agent/swarm';
import { SwarmModeEnter } from '#/features/swarm/swarmOps';
import { IAgentTowerService } from '#/features/tower/tower';
import { TowerModeEnter } from '#/features/tower/towerOps';
import { IEventDispatcher } from '#/state/eventDispatcher';

import { IAgentModeMutexService } from './modeMutex';

type InteractionMode = 'plan' | 'ask' | 'debug';

export class AgentModeMutexService extends Disposable implements IAgentModeMutexService {
  declare readonly _serviceBrand: undefined;

  constructor(
    @IAgentPlanService private readonly plan: IAgentPlanService,
    @IAgentAskModeService private readonly ask: IAgentAskModeService,
    @IAgentDebugModeService private readonly debug: IAgentDebugModeService,
    @IAgentSwarmService private readonly swarm: IAgentSwarmService,
    @IAgentTowerService private readonly tower: IAgentTowerService,
    @IAgentGoalService private readonly goal: IAgentGoalService | undefined,
    @IAgentStateService private readonly agentState: IAgentStateService,
    @IEventDispatcher private readonly dispatcher: IEventDispatcher,
    @IEventBus eventBus: IEventBus,
  ) {
    super();
    this._register(
      eventBus.subscribe(PlanModeEnter, () => {
        this.exitOtherInteractionModes('plan');
        if (this.tower.isActive) void this.tower.exit('mode-mutex');
      }),
    );
    this._register(
      eventBus.subscribe(AskModeEnter, () => {
        this.exitOtherInteractionModes('ask');
        if (this.swarm.isActive) this.swarm.exit();
        if (this.tower.isActive) void this.tower.exit('mode-mutex');
      }),
    );
    this._register(
      eventBus.subscribe(DebugModeEnter, () => {
        this.exitOtherInteractionModes('debug');
        if (this.swarm.isActive) this.swarm.exit();
        if (this.tower.isActive) void this.tower.exit('mode-mutex');
      }),
    );
    this._register(
      eventBus.subscribe(SwarmModeEnter, () => {
        this.exitOtherInteractionModes('plan');
        if (this.tower.isActive) void this.tower.exit('mode-mutex');
      }),
    );
    this._register(
      eventBus.subscribe(TowerModeEnter, () => {
        this.exitOtherInteractionModes(undefined);
        if (this.swarm.isActive) this.swarm.exit();
        if (this.goal?.getGoal().goal?.status === 'active') {
          void this.goal.pauseGoal({ reason: 'Paused after tower mode entered' }, 'system');
        }
      }),
    );
    this._register(
      eventBus.subscribe(GoalUpdated, (event) => {
        if (event.snapshot?.status !== 'active') return;
        if (!this.tower.isActive) return;
        void this.dispatcher.dispatch(
          new AgentStatusUpdated({
            agentId: event.agentId,
            towerMode: false,
            towerExitReason: 'mode-mutex',
          }),
        );
        void this.tower.exit('mode-mutex');
      }),
    );
  }

  private exitOtherInteractionModes(keep: InteractionMode | undefined): void {
    if (keep !== 'plan' && this.agentState.get(planKey).active) this.plan.exit();
    if (keep !== 'ask' && this.ask.isActive()) this.ask.exit();
    if (keep !== 'debug' && this.debug.isActive()) this.debug.exit();
  }
}

registerScopedService(
  LifecycleScope.Agent,
  IAgentModeMutexService,
  AgentModeMutexService,
  ScopeActivation.OnScopeCreated,
  'modeMutex',
);
