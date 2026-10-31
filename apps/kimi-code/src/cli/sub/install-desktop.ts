import type { Command } from 'commander';

import { kimiCodeOfficialInstallUrl, PRODUCT_NAME } from '#/constant/app';
import { openUrl } from '#/utils/open-url';

function openDesktopAppPage(): void {
  const url = kimiCodeOfficialInstallUrl();
  process.stdout.write(`${url}\n`);
  openUrl(url);
}

export function registerInstallDesktopCommand(program: Command): void {
  program
    .command('install-desktop')
    .description(`Print the ${PRODUCT_NAME} desktop app page and open it in your browser.`)
    .action(openDesktopAppPage);

  program.command('install-app', { hidden: true }).action(openDesktopAppPage);
}
