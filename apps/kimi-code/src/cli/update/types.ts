/** Where the running CLI was installed from. Used by export and feedback. */
export type InstallSource =
  | 'npm-global'
  | 'pnpm-global'
  | 'yarn-global'
  | 'bun-global'
  | 'homebrew'
  | 'native'
  | 'unsupported';
