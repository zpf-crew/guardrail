import type { UiBrowserAgentAction } from '../../validation/workbench-validators.js';

export interface AgentBrowserCommandAction {
  kind: 'agentBrowserCommand';
  command: string;
  args: string[];
  reason: string;
}

const SIMPLE_COMMANDS = new Set([
  'click',
  'dblclick',
  'hover',
  'focus',
  'press',
  'fill',
  'type',
  'check',
  'uncheck',
  'select',
  'scroll',
  'scrollintoview',
  'wait',
  'back',
  'forward',
  'reload',
  'screenshot',
  'snapshot',
  'open',
]);

const STRUCTURED_COMMANDS = new Set(['keyboard', 'get', 'is', 'find']);
const REF_COMMANDS = new Set([
  'click',
  'dblclick',
  'hover',
  'focus',
  'fill',
  'type',
  'check',
  'uncheck',
  'select',
  'scrollintoview',
]);
const NAVIGATION_CHECK_COMMANDS = new Set([
  'open',
  'click',
  'dblclick',
  'press',
  'fill',
  'type',
  'check',
  'uncheck',
  'select',
  'keyboard',
  'find',
  'back',
  'forward',
  'reload',
]);

const BLOCKED_COMMANDS = new Set([
  'eval',
  'batch',
  'download',
  'upload',
  'network',
  'auth',
  'connect',
  'close',
  'install',
  'upgrade',
  'doctor',
  'dashboard',
  'stream',
  'record',
  'trace',
  'profiler',
  'pdf',
  'clipboard',
  'confirm',
  'deny',
  'chat',
]);

const SNAPSHOT_FLAGS = new Set(['-i', '--interactive', '-c', '--compact']);
const KEYBOARD_SUBCOMMANDS = new Set(['type', 'inserttext']);
const GET_SUBCOMMANDS = new Set(['text', 'value', 'title', 'url', 'count', 'box', 'attr']);
const IS_SUBCOMMANDS = new Set(['visible', 'enabled', 'checked']);
const FIND_LOCATORS = new Set([
  'role',
  'text',
  'label',
  'placeholder',
  'alt',
  'title',
  'testid',
  'first',
  'last',
  'nth',
]);

type ActionWithKind = { kind?: unknown };

export function isAgentBrowserCommandAction(
  action: UiBrowserAgentAction,
): action is UiBrowserAgentAction & AgentBrowserCommandAction {
  return (action as ActionWithKind).kind === 'agentBrowserCommand';
}

export function isExecutableAgentBrowserCommand(action: UiBrowserAgentAction): boolean {
  return isAgentBrowserCommandAction(action);
}

export function validateAgentBrowserCommand(action: AgentBrowserCommandAction): AgentBrowserCommandAction {
  const command = normalizeCommand(action.command);
  const args = normalizeArgs(action.args);
  const reason = typeof action.reason === 'string' ? action.reason.trim() : '';

  if (!command) {
    throw new Error('Agent browser command is required.');
  }
  if (!reason) {
    throw new Error('Agent browser command reason is required.');
  }
  if (BLOCKED_COMMANDS.has(command)) {
    throw new Error(`Command "${command}" is not allowed.`);
  }
  if (!SIMPLE_COMMANDS.has(command) && !STRUCTURED_COMMANDS.has(command)) {
    throw new Error(`Command "${command}" is not allowed.`);
  }

  validateCommandArgs(command, args);

  return {
    kind: 'agentBrowserCommand',
    command,
    args,
    reason,
  };
}

export function agentBrowserCommandArgs(baseUrl: string, action: AgentBrowserCommandAction): string[] {
  const validated = validateAgentBrowserCommand(action);
  if (validated.command === 'open') {
    return ['open', resolveOpenTarget(baseUrl, validated.args[0] ?? '/')];
  }
  return [validated.command, ...validated.args];
}

export function shouldVerifySameOriginAfterCommand(action: AgentBrowserCommandAction): boolean {
  const validated = validateAgentBrowserCommand(action);
  return NAVIGATION_CHECK_COMMANDS.has(validated.command);
}

export function assertSameOriginUrl(baseUrl: string, currentUrl: string): void {
  const base = new URL(baseUrl);
  const current = new URL(currentUrl.trim());
  if (current.origin !== base.origin) {
    throw new Error(`External navigation is not allowed: ${current.toString()}`);
  }
}

function normalizeCommand(command: unknown): string {
  return typeof command === 'string' ? command.trim().toLowerCase() : '';
}

function normalizeArgs(args: unknown): string[] {
  if (!Array.isArray(args)) return [];
  return args.map(arg => String(arg));
}

function validateCommandArgs(command: string, args: string[]): void {
  if (command === 'open') {
    if (args.length > 1) throw new Error('open accepts at most one URL or path argument.');
    return;
  }
  if (command === 'screenshot') {
    if (args.length > 0) throw new Error('screenshot does not accept custom paths.');
    return;
  }
  if (command === 'snapshot') {
    const invalidFlag = args.find(arg => !SNAPSHOT_FLAGS.has(arg));
    if (invalidFlag) throw new Error(`snapshot flag "${invalidFlag}" is not allowed.`);
    return;
  }
  if (command === 'wait') {
    validateWaitArgs(args);
    return;
  }
  if (command === 'back' || command === 'forward' || command === 'reload') {
    if (args.length > 0) throw new Error(`${command} does not accept arguments.`);
    return;
  }
  if (command === 'keyboard') {
    validateKeyboardArgs(args);
    return;
  }
  if (command === 'get') {
    validateGetArgs(args);
    return;
  }
  if (command === 'is') {
    validateIsArgs(args);
    return;
  }
  if (command === 'find') {
    validateFindArgs(args);
    return;
  }
  if (args.length < 1) {
    throw new Error(`${command} requires at least one argument.`);
  }
  if (REF_COMMANDS.has(command)) {
    validateNoFlags(command, args);
  }
}

function validateKeyboardArgs(args: string[]): void {
  const subcommand = args[0]?.toLowerCase();
  if (!subcommand || !KEYBOARD_SUBCOMMANDS.has(subcommand)) {
    throw new Error('keyboard only allows type and inserttext subcommands.');
  }
  if (args.length < 2 || !args[1]) {
    throw new Error('keyboard requires text.');
  }
  args[0] = subcommand;
}

function validateGetArgs(args: string[]): void {
  const subcommand = args[0]?.toLowerCase();
  if (!subcommand || !GET_SUBCOMMANDS.has(subcommand)) {
    throw new Error('get subcommand is not allowed.');
  }
  if (subcommand === 'attr') {
    if (args.length < 3 || !args[1] || !args[2]) {
      throw new Error('get attr requires attribute name and selector.');
    }
  }
  args[0] = subcommand;
}

function validateIsArgs(args: string[]): void {
  const subcommand = args[0]?.toLowerCase();
  if (!subcommand || !IS_SUBCOMMANDS.has(subcommand)) {
    throw new Error('is subcommand is not allowed.');
  }
  if (args.length < 2 || !args[1]) {
    throw new Error('is requires selector.');
  }
  args[0] = subcommand;
}

function validateFindArgs(args: string[]): void {
  const locator = args[0]?.toLowerCase();
  if (!locator || !FIND_LOCATORS.has(locator)) {
    throw new Error('find locator is not allowed.');
  }
  if (args.length < 3 || !args[1] || !args[2]) {
    throw new Error('find requires locator, value, and action arguments.');
  }
  const allowedFlags = new Set(['--name', '--exact']);
  for (const arg of args.slice(3)) {
    if (arg.startsWith('-') && !allowedFlags.has(arg)) {
      throw new Error(`find flag "${arg}" is not allowed.`);
    }
  }
  args[0] = locator;
}

function validateWaitArgs(args: string[]): void {
  if (args.length < 1 || args.length > 2) {
    throw new Error('wait requires one or two arguments.');
  }
  if (args[0] === '--fn') {
    throw new Error('wait --fn is not allowed.');
  }
  if (args[0] === '--load') {
    if (!['networkidle', 'domcontentloaded'].includes(args[1] ?? '')) {
      throw new Error('wait --load requires networkidle or domcontentloaded.');
    }
    return;
  }
  if (args[0]?.startsWith('--') && !['--text', '--url'].includes(args[0])) {
    throw new Error(`wait flag "${args[0]}" is not allowed.`);
  }
}

function validateNoFlags(command: string, args: string[]): void {
  const flag = args.find(arg => arg.startsWith('-'));
  if (flag) {
    throw new Error(`${command} flag "${flag}" is not allowed.`);
  }
}

function resolveOpenTarget(baseUrl: string, rawTarget: string): string {
  const base = new URL(baseUrl);
  const target = new URL(rawTarget || '/', base);
  if (target.origin !== base.origin) {
    throw new Error('External navigation is not allowed.');
  }
  return target.toString();
}
