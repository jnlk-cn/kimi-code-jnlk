import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FolderOpen, Globe2, Play, Square, Trash2 } from 'lucide-react';

import type { SiteRecord } from '../../shared/contracts';
import { ConfirmSheet, EmptyState, PageFrame, messageOf } from '../page-chrome';

const api = window.ganymede;

export function SitesPage(props: {
  readonly onError: (message: string) => void;
  readonly onPreviewInBrowser?: (url: string) => void;
}): ReactNode {
  const [sites, setSites] = useState<readonly SiteRecord[]>([]);
  const [path, setPath] = useState('');
  const [title, setTitle] = useState('');
  const [pathWarning, setPathWarning] = useState<string>();
  const [removeTarget, setRemoveTarget] = useState<SiteRecord>();

  const refresh = useCallback(() => {
    void api.listSites().then(setSites).catch((cause) => props.onError(messageOf(cause)));
  }, [props.onError]);
  useEffect(refresh, [refresh]);

  return (
    <>
      <PageFrame
        icon={<Globe2 />}
        title="本地站点"
        subtitle="预览、分享并管理代理生成的本地交互式站点。"
      >
        <div className="install-row">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="站点名称"
          />
          <input
            value={path}
            onChange={(event) => {
              setPath(event.target.value);
              setPathWarning(undefined);
            }}
            placeholder="/absolute/path/to/site"
          />
          <button
            onClick={() => {
              void api.pickSiteDirectory().then((picked) => {
                if (picked === undefined) return;
                setPath(picked);
                if (title.trim().length === 0) {
                  const base = picked.split(/[/\\]/).filter(Boolean).at(-1);
                  if (base !== undefined) setTitle(base);
                }
                setPathWarning(undefined);
              });
            }}
            type="button"
          >
            <FolderOpen size={14} /> 选择目录
          </button>
          <button
            className="primary-button"
            disabled={!title.trim() || !path.trim()}
            onClick={() => {
              void api
                .saveSite({ title: title.trim(), path: path.trim() })
                .then(() => {
                  setTitle('');
                  setPath('');
                  setPathWarning(undefined);
                  refresh();
                })
                .catch((cause) => {
                  const message = messageOf(cause);
                  if (/index\.html/i.test(message)) setPathWarning(message);
                  else props.onError(message);
                });
            }}
            type="button"
          >
            添加
          </button>
        </div>
        {pathWarning === undefined ? null : <small className="settings-note">{pathWarning}</small>}
        <div className="site-grid">
          {sites.map((site) => (
            <article className="site-card" key={site.id}>
              <div className="site-preview"><Globe2 size={34} /></div>
              <strong>{site.title}</strong>
              <p>{site.path}</p>
              {site.url === undefined ? (
                <small>未运行</small>
              ) : (
                <small className="site-url-status">{site.url}</small>
              )}
              <div>
                <button
                  onClick={() =>
                    void api
                      .serveSite(site.id)
                      .then((served) => {
                        if (served.url) {
                          if (props.onPreviewInBrowser !== undefined) {
                            props.onPreviewInBrowser(served.url);
                          } else {
                            void api.openExternal(served.url);
                          }
                        }
                        refresh();
                      })
                      .catch((cause) => props.onError(messageOf(cause)))
                  }
                  type="button"
                >
                  <Play size={13} /> 预览
                </button>
                <button
                  onClick={() =>
                    void api
                      .serveSite(site.id, true)
                      .then((served) => {
                        if (served.url) void navigator.clipboard.writeText(served.url);
                        refresh();
                      })
                      .catch((cause) => props.onError(messageOf(cause)))
                  }
                  type="button"
                >
                  局域网分享
                </button>
                {site.url === undefined ? null : (
                  <>
                    <button onClick={() => void api.openExternal(site.url!)} type="button">
                      打开
                    </button>
                    <button
                      onClick={() =>
                        void api.stopSite(site.id).then(refresh).catch((cause) => props.onError(messageOf(cause)))
                      }
                      type="button"
                    >
                      <Square size={12} /> 停止
                    </button>
                  </>
                )}
                <button
                  aria-label={`删除 ${site.title}`}
                  className="danger"
                  onClick={() => setRemoveTarget(site)}
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          ))}
          {sites.length === 0 ? (
            <EmptyState
              icon={<Globe2 />}
              title="还没有本地站点"
              body="添加包含静态资源的目录，或让代理通过 GanymedeSites 注册生成的页面。"
            />
          ) : null}
        </div>
      </PageFrame>
      {removeTarget === undefined ? null : (
        <ConfirmSheet
          title="删除本地站点"
          body={`确定删除“${removeTarget.title}”吗？只会移除登记记录，不会删除磁盘上的文件。`}
          confirmLabel="删除站点"
          danger
          onClose={() => setRemoveTarget(undefined)}
          onConfirm={() => {
            const target = removeTarget;
            setRemoveTarget(undefined);
            void api.deleteSite(target.id).then(refresh).catch((cause) => props.onError(messageOf(cause)));
          }}
        />
      )}
    </>
  );
}
