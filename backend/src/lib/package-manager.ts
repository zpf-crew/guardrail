export type NodePackageManager = 'npm' | 'pnpm' | 'yarn';

export interface PackageInstallCommand {
  command: NodePackageManager;
  args: string[];
}

export function buildPackageInstallCommand(packageManager: NodePackageManager): PackageInstallCommand {
  if (packageManager === 'pnpm') {
    return { command: 'pnpm', args: ['install', '--frozen-lockfile', '--prod=false'] };
  }

  if (packageManager === 'yarn') {
    return { command: 'yarn', args: ['install', '--frozen-lockfile', '--production=false'] };
  }

  return { command: 'npm', args: ['install', '--include=dev', '--no-audit', '--no-fund'] };
}

export function formatPackageInstallCommand(packageManager: NodePackageManager): string {
  const install = buildPackageInstallCommand(packageManager);
  return `${install.command} ${install.args.join(' ')}`;
}
