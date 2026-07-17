import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Boxes,
  Command,
  Plug,
  Server,
  Trash2,
  WandSparkles,
} from 'lucide-react';

import type {
  McpServerView,
  PluginCommandView,
  PluginMarketplaceEntryView,
  PluginMarketplaceView,
  PluginView,
  ProjectSummary,
  SessionSnapshot,
  SkillView,
} from '../../shared/contracts';
import { ConfirmSheet, EmptyState, Modal, PageFrame, messageOf } from '../page-chrome';

const api = window.ganymede;

type PluginsTab = 'plugins' | 'skills' | 'commands' | 'mcp' | 'marketplace';

export function PluginsPage(props: {
  readonly session?: SessionSnapshot;
  readonly project?: ProjectSummary;
  readonly onError: (message: string) => void;
  readonly onOpenTask: (sessionId: string) => void;
}): ReactNode {
  const [tab, setTab] = useState<PluginsTab>('plugins');
  const [plugins, setPlugins] = useState<readonly PluginView[]>([]);
  const [skills, setSkills] = useState<readonly SkillView[]>([]);
  const [commands, setCommands] = useState<readonly PluginCommandView[]>([]);
  const [mcp, setMcp] = useState<readonly McpServerView[]>([]);
  const [marketplace, setMarketplace] = useState<PluginMarketplaceView>();
  const [source, setSource] = useState('');
  const [installTarget, setInstallTarget] = useState<string>();
  const [removeTarget, setRemoveTarget] = useState<PluginView>();
  const [skillDetail, setSkillDetail] = useState<SkillView>();
  const [marketQuery, setMarketQuery] = useState('');
  const [marketTier, setMarketTier] = useState<'all' | 'official' | 'curated'>('all');

  const refresh = useCallback(() => {
    void Promise.all([
      api.listPlugins(props.session?.id),
      api.listSkills(props.session?.id, props.session?.workDir ?? props.project?.workDir),
      api.listPluginCommands(props.session?.id),
      api.listMcp(props.session?.id),
      api.listPluginMarketplace(props.session?.id, props.project?.workDir).catch(() => undefined),
    ])
      .then(([nextPlugins, nextSkills, nextCommands, nextMcp, nextMarketplace]) => {
        setPlugins(nextPlugins);
        setSkills(nextSkills);
        setCommands(nextCommands);
        setMcp(nextMcp);
        if (nextMarketplace !== undefined) setMarketplace(nextMarketplace);
      })
      .catch((cause) => props.onError(messageOf(cause)));
  }, [props.session?.id, props.session?.workDir, props.project?.workDir, props.onError]);

  useEffect(refresh, [refresh]);

  const mutate = (operation: Promise<unknown>): void => {
    void operation.then(refresh).catch((cause) => props.onError(messageOf(cause)));
  };

  const filteredMarket = useMemo(() => {
    const entries = marketplace?.plugins ?? [];
    const needle = marketQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (marketTier !== 'all' && entry.tier !== marketTier) return false;
      if (needle.length === 0) return true;
      return `${entry.displayName} ${entry.id} ${entry.description ?? ''} ${(entry.keywords ?? []).join(' ')}`
        .toLowerCase()
        .includes(needle);
    });
  }, [marketplace, marketQuery, marketTier]);

  return (
    <>
      <PageFrame
        icon={<WandSparkles />}
        title="技能与插件"
        subtitle="扩展 Ganymede 的工具、Skill、命令和 MCP 连接。"
      >
        <div className="page-toolbar">
          <div className="segmented-control" role="tablist" aria-label="技能与插件分区">
            {(
              [
                ['plugins', '插件'],
                ['skills', 'Skills'],
                ['commands', '命令'],
                ['mcp', 'MCP'],
                ['marketplace', '市场'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-selected={tab === value}
                className={tab === value ? 'selected' : undefined}
                onClick={() => setTab(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'plugins' ? (
          <>
            <div className="install-row">
              <input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="本地路径、GitHub URL 或插件 ZIP"
              />
              <button
                className="primary-button"
                disabled={source.trim().length === 0}
                onClick={() => setInstallTarget(source.trim())}
                type="button"
              >
                安装
              </button>
            </div>
            <div className="tile-grid">
              {plugins.map((plugin) => (
                <article className={`plugin-tile${plugin.hasErrors ? ' error' : ''}`} key={plugin.id}>
                  <span className="plugin-logo"><Boxes size={20} /></span>
                  <div className="plugin-details">
                    <strong>{plugin.name}</strong>
                    <p>{plugin.description ?? plugin.id}</p>
                    <small>
                      {plugin.skillCount} Skills · {plugin.commandCount} 命令 ·{' '}
                      {plugin.enabledMcpServerCount}/{plugin.mcpServerCount} MCP · {plugin.hookCount} Hooks
                      {plugin.version === undefined ? '' : ` · v${plugin.version}`}
                    </small>
                    {plugin.diagnostics.map((diagnostic, index) => (
                      <small
                        className={`plugin-diagnostic ${diagnostic.severity}`}
                        key={`${diagnostic.message}:${String(index)}`}
                      >
                        {diagnostic.message}
                      </small>
                    ))}
                  </div>
                  <div className="plugin-actions">
                    <button
                      disabled={plugin.id === 'ganymede-desktop'}
                      onClick={() => mutate(api.enablePlugin(plugin.id, !plugin.enabled, props.session?.id))}
                      type="button"
                    >
                      {plugin.enabled ? '停用' : '启用'}
                    </button>
                    {plugin.id === 'ganymede-desktop' ? null : (
                      <button className="danger" onClick={() => setRemoveTarget(plugin)} type="button">
                        <Trash2 size={11} /> 移除
                      </button>
                    )}
                  </div>
                  {plugin.mcpServers.length > 0 ? (
                    <div className="plugin-mcp-list">
                      {plugin.mcpServers.map((server) => (
                        <label key={server.name}>
                          <span>
                            <Server size={12} /> {server.name}
                            <small>{server.transport}</small>
                          </span>
                          <input
                            checked={server.enabled}
                            onChange={(event) =>
                              mutate(
                                api.enablePluginMcp(
                                  plugin.id,
                                  server.name,
                                  event.target.checked,
                                  props.session?.id,
                                ),
                              )
                            }
                            type="checkbox"
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        ) : null}

        {tab === 'skills' ? (
          <div className="skill-list">
            {skills.map((skill) => (
              <div key={skill.name}>
                <WandSparkles size={14} />
                <span>
                  <strong>{skill.name}</strong>
                  <small>
                    {skill.description} · {skill.source ?? 'unknown'}
                    {skill.type === undefined ? '' : ` · ${skill.type}`}
                  </small>
                </span>
                <button onClick={() => setSkillDetail(skill)} type="button">
                  详情
                </button>
                {skill.userActivatable ? (
                  <button
                    className="primary-button"
                    onClick={() =>
                      void api
                        .activateSkill(
                          props.session?.id,
                          skill.name,
                          undefined,
                          props.project?.workDir ?? props.session?.workDir,
                        )
                        .then((result) => {
                          if (props.session?.id !== result.sessionId) {
                            props.onOpenTask(result.sessionId);
                          }
                          refresh();
                        })
                        .catch((cause) => props.onError(messageOf(cause)))
                    }
                    type="button"
                  >
                    运行
                  </button>
                ) : (
                  <small>仅供模型</small>
                )}
              </div>
            ))}
            {skills.length === 0 ? (
              <EmptyState icon={<WandSparkles />} title="没有可用 Skills" body="安装插件或在项目中添加 skill 目录。" />
            ) : null}
          </div>
        ) : null}

        {tab === 'commands' ? (
          <div className="skill-list">
            {commands.map((command) => (
              <div key={`${command.pluginId}:${command.name}`}>
                <Command size={14} />
                <span>
                  <strong>
                    /{command.pluginId}:{command.name}
                  </strong>
                  <small>{command.description}</small>
                </span>
                <button
                  className="primary-button"
                  onClick={() =>
                    void api
                      .activatePluginCommand(
                        props.session?.id,
                        command.pluginId,
                        command.name,
                        undefined,
                        props.project?.workDir ?? props.session?.workDir,
                      )
                      .then((result) => {
                        if (props.session?.id !== result.sessionId) {
                          props.onOpenTask(result.sessionId);
                        }
                        refresh();
                      })
                      .catch((cause) => props.onError(messageOf(cause)))
                  }
                  type="button"
                >
                  运行
                </button>
              </div>
            ))}
            {commands.length === 0 ? (
              <EmptyState icon={<Command />} title="没有插件命令" body="已安装插件贡献的 slash 命令会出现在这里。" />
            ) : null}
          </div>
        ) : null}

        {tab === 'mcp' ? (
          <div className="skill-list">
            {mcp.map((server) => (
              <div key={server.name}>
                <span className={`connection ${server.status}`} />
                <span>
                  <strong>{server.name}</strong>
                  <small>
                    {server.status} · {server.toolCount} tools
                    {server.error === undefined ? '' : ` · ${server.error}`}
                  </small>
                </span>
                <button
                  onClick={() => mutate(api.reconnectMcp(props.session?.id, server.name))}
                  type="button"
                >
                  重连
                </button>
              </div>
            ))}
            {mcp.length === 0 ? (
              <EmptyState icon={<Plug />} title="没有 MCP 连接" body="通过插件或配置启用 MCP 服务器后可在此管理。" />
            ) : null}
          </div>
        ) : null}

        {tab === 'marketplace' ? (
          <>
            <div className="install-row">
              <input
                value={marketQuery}
                onChange={(event) => setMarketQuery(event.target.value)}
                placeholder="搜索市场插件"
              />
              <div className="segmented-control" role="tablist" aria-label="市场分类">
                {(
                  [
                    ['all', '全部'],
                    ['official', '官方'],
                    ['curated', '精选'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-selected={marketTier === value}
                    className={marketTier === value ? 'selected' : undefined}
                    onClick={() => setMarketTier(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="tile-grid">
              {filteredMarket.map((entry) => (
                <MarketplaceTile
                  key={entry.id}
                  entry={entry}
                  onInstall={() => setInstallTarget(entry.source)}
                />
              ))}
            </div>
            {filteredMarket.length === 0 ? (
              <EmptyState
                icon={<Boxes />}
                title="市场暂无结果"
                body={marketplace === undefined ? '无法加载插件市场，请检查网络后重试。' : '试试其他关键词或分类。'}
              />
            ) : null}
          </>
        ) : null}
      </PageFrame>

      {installTarget !== undefined ? (
        <ConfirmSheet
          title="信任并安装插件"
          body={`插件可以加载 Skills、命令、Hooks 和 MCP 服务，并可能执行本地程序。仅在信任来源时安装：${installTarget}`}
          confirmLabel="信任并安装"
          onClose={() => setInstallTarget(undefined)}
          onConfirm={() => {
            const target = installTarget;
            setInstallTarget(undefined);
            void api
              .installPlugin(target, props.session?.id)
              .then(() => {
                setSource('');
                refresh();
              })
              .catch((cause) => props.onError(messageOf(cause)));
          }}
        />
      ) : null}

      {removeTarget !== undefined ? (
        <ConfirmSheet
          title="移除插件"
          body={`确定移除“${removeTarget.name}”吗？插件提供的 Skills、命令与 MCP 将从后续任务中移除。`}
          confirmLabel="移除插件"
          danger
          onClose={() => setRemoveTarget(undefined)}
          onConfirm={() => {
            const target = removeTarget;
            setRemoveTarget(undefined);
            mutate(api.removePlugin(target.id, props.session?.id));
          }}
        />
      ) : null}

      {skillDetail === undefined ? null : (
        <Modal title={skillDetail.name} onClose={() => setSkillDetail(undefined)}>
          <p>{skillDetail.description ?? '无描述'}</p>
          <small>
            来源：{skillDetail.source ?? 'unknown'}
            {skillDetail.type === undefined ? '' : ` · ${skillDetail.type}`}
            {skillDetail.path === undefined ? '' : ` · ${skillDetail.path}`}
          </small>
          <p>
            {skillDetail.userActivatable
              ? '可从界面运行；也会在对话中由模型按需激活。'
              : '仅供模型调用，界面无法直接运行。'}
          </p>
          <div className="modal-actions">
            <button onClick={() => setSkillDetail(undefined)} type="button">
              关闭
            </button>
            {skillDetail.userActivatable ? (
              <button
                className="primary-button"
                onClick={() => {
                  const skill = skillDetail;
                  setSkillDetail(undefined);
                  void api
                    .activateSkill(
                      props.session?.id,
                      skill.name,
                      undefined,
                      props.project?.workDir ?? props.session?.workDir,
                    )
                    .then((result) => {
                      if (props.session?.id !== result.sessionId) {
                        props.onOpenTask(result.sessionId);
                      }
                    })
                    .catch((cause) => props.onError(messageOf(cause)));
                }}
                type="button"
              >
                运行
              </button>
            ) : null}
          </div>
        </Modal>
      )}
    </>
  );
}

function MarketplaceTile(props: {
  readonly entry: PluginMarketplaceEntryView;
  readonly onInstall: () => void;
}): ReactNode {
  const statusLabel =
    props.entry.updateStatus.kind === 'update'
      ? `可更新 ${props.entry.updateStatus.local} → ${props.entry.updateStatus.latest}`
      : props.entry.installed
        ? '已安装'
        : '未安装';
  return (
    <article className="plugin-tile">
      <span className="plugin-logo"><Boxes size={20} /></span>
      <div className="plugin-details">
        <strong>{props.entry.displayName}</strong>
        <p>{props.entry.description ?? props.entry.id}</p>
        <small>
          {props.entry.tier ?? 'third-party'}
          {props.entry.version === undefined ? '' : ` · v${props.entry.version}`} · {statusLabel}
        </small>
      </div>
      <div className="plugin-actions">
        {props.entry.homepage === undefined ? null : (
          <button onClick={() => void api.openExternal(props.entry.homepage!)} type="button">
            主页
          </button>
        )}
        <button
          className="primary-button"
          onClick={props.onInstall}
          type="button"
        >
          {props.entry.updateStatus.kind === 'update'
            ? '更新'
            : props.entry.installed
              ? '重新安装'
              : '安装'}
        </button>
      </div>
    </article>
  );
}
