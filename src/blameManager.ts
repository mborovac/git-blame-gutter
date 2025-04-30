import * as vscode from 'vscode';
import * as path from 'path';
import * as util from 'util';
import { exec } from 'child_process';

const execPromise = util.promisify(exec);

let isBlameVisible = false;
let currentDecorationType: vscode.TextEditorDecorationType | null = null;

export async function toggleGitBlame() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return;}

  const document = editor.document;
  const filePath = document.uri.fsPath;
  const fileDir = path.dirname(filePath);

  if (isBlameVisible && currentDecorationType) {
    clearDecorations(editor);
    return;
  }

  if (!(await isGitRepo(fileDir))) {
    vscode.window.showInformationMessage('No Git repository found.');
    return;
  }

  const { blameLines, commitHashes } = await getBlameInfo(filePath, fileDir);
  const decorations = generateDecorations(blameLines, commitHashes);

  currentDecorationType = vscode.window.createTextEditorDecorationType({});

  editor.setDecorations(currentDecorationType, decorations);
  isBlameVisible = true;
}

function clearDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(currentDecorationType!, []);
  currentDecorationType!.dispose();
  currentDecorationType = null;
  isBlameVisible = false;
}

async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execPromise('git rev-parse --show-toplevel', { cwd });
    return true;
  } catch {
    return false;
  }
}

async function getBlameInfo(filePath: string, cwd: string): Promise<{ blameLines: string[]; commitHashes: string[] }> {
  const output = await execPromise(`git blame --line-porcelain "${filePath}"`, { cwd });
  const lines = output.stdout.split('\n');

  const blameLines: string[] = [];
  const commitHashes: string[] = [];
  let currentHash = '';
  let currentAuthor = '';
  let currentDate = '';

  for (const line of lines) {
    if (/^[0-9a-f]{40} /.test(line)) {
      currentHash = line.split(' ')[0];
      commitHashes.push(currentHash);
    } else if (line.startsWith('author ')) {
      currentAuthor = line.replace('author ', '');
    } else if (line.startsWith('author-time ')) {
      const timestamp = parseInt(line.replace('author-time ', ''));
      currentDate = new Date(timestamp * 1000).toISOString().split('T')[0];
      blameLines.push(`${currentHash.slice(0, 8)} ${currentDate} ${currentAuthor}  `);
    }
  }

  return { blameLines, commitHashes };
}

function generateDecorations(blameLines: string[], commitHashes: string[]): vscode.DecorationOptions[] {
  const maxLength = Math.max(...blameLines.map(text => text.length));

  // const paddedBlame = blameLines.map(text =>
  //   text.trim() === '' ? '\u00A0'.repeat(maxLength) : text + '\u00A0'.repeat(maxLength - text.length)
  // );
  const paddedBlame = blameLines.map(text =>
    text + '\u00A0'.repeat(maxLength - text.length) // use non-breaking spaces for consistent width
  );

  const decorations: vscode.DecorationOptions[] = [];
  let lastHash = '';
  let backgroundToggle = false;

  for (let i = 0; i < paddedBlame.length; i++) {
    const hash = commitHashes[i];
    if (hash !== lastHash) {
      backgroundToggle = !backgroundToggle;
      lastHash = hash;
    }

    decorations.push({
      range: new vscode.Range(i, 0, i, 0),
      renderOptions: {
        before: {
          contentText: paddedBlame[i],
          backgroundColor: backgroundColor(backgroundToggle),
          color: '#000',
          margin: '0 8px 0 0',
          border: '1px solid black',
          // fontWeight: 'normal',
          // fontStyle: 'normal',
          // fontFamily: 'monospace',
          // letterSpacing: '0.3px' // small tweak for visual uniformity
        }
      }
    });
  }

  return decorations;
}

function backgroundColor(backgroundToggle: boolean) {
  const colors = ['#e0e0e0', '#c0c0c0'];
  // const colors = ['#30333C', '#22252A'];
  // const colors = ['yellow', 'green'];

  return backgroundToggle ? colors[0] : colors[1];
}

