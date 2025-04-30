import * as vscode from 'vscode';
import { toggleGitBlame } from './blameManager';

export function activate(context: vscode.ExtensionContext) {
  const toggleCommand = vscode.commands.registerCommand('git-blame-gutter.toggleGitBlame', toggleGitBlame);
  context.subscriptions.push(toggleCommand);
}

export function deactivate() {}
