import { resolve } from 'node:path';
import type { Command } from 'commander';

import { CLI_COMMAND_NAME, PRODUCT_NAME } from '#/constant/app';
import { openUrl } from '#/utils/open-url';

export function registerAppCommand(program: Command): void {
  program
    .command('app [path]')
    .description(`Open a new chat in the ${PRODUCT_NAME} desktop app for this directory.`)
    .action((path?: string) => {
      const root = resolve(path ?? process.cwd());
      openUrl(`kimi-code://open?root=${encodeURIComponent(root)}&new=1`, () => {
        process.stderr.write(
          `Could not open ${PRODUCT_NAME} desktop. Run \`${CLI_COMMAND_NAME} install-desktop\` to install it.\n`,
        );
        process.exitCode = 1;
      });
    });
}
