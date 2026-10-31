import { kimiCodeOfficialInstallUrl } from '#/constant/app';
import { tFormat } from '#/tui/i18n';
import { openUrl } from '#/utils/open-url';

import type { SlashCommandHost } from './dispatch';

export async function handleDesktopCommand(host: SlashCommandHost): Promise<void> {
  const url = kimiCodeOfficialInstallUrl();
  host.showStatus(tFormat('{url} — opened in your browser', { url }));
  openUrl(url);
}
