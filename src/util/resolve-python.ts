/**
 * Resolve the Python executable for Whisper/transcribe.
 * Cursor/IDE-launched Node often lacks `python` on PATH even when PowerShell has it.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';

export type PythonInvocation = {
  executable: string;
  /** Args after executable (includes script path and script arguments). */
  args: string[];
};

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function tryWhereOnWindows(command: string): string | null {
  const whereExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'where.exe');
  if (!exists(whereExe)) return null;
  try {
    const out = execFileSync(whereExe, [command], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const line = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s.length > 0 && exists(s));
    return line ?? null;
  } catch {
    return null;
  }
}

function commonWindowsPythonPaths(): string[] {
  const local = process.env.LOCALAPPDATA || '';
  const pf = process.env.PROGRAMFILES || '';
  const pfx86 = process.env['PROGRAMFILES(X86)'] || '';
  const versions = ['314', '313', '312', '311', '310', '39'];
  const out: string[] = [];
  for (const v of versions) {
    out.push(path.join(local, 'Programs', 'Python', `Python${v}`, 'python.exe'));
    out.push(path.join(pf, `Python${v}`, 'python.exe'));
    out.push(path.join(pfx86, `Python${v}`, 'python.exe'));
  }
  return out;
}

/**
 * Build argv for execFileSync: [executable, ...args].
 */
export function resolvePythonAndArgs(scriptPath: string, scriptArgs: string[]): PythonInvocation {
  const explicit = process.env.PYTHON_PATH?.trim();
  if (explicit && exists(explicit)) {
    const base = path.basename(explicit).toLowerCase();
    if (base === 'py.exe' || base === 'py') {
      return { executable: explicit, args: ['-3', scriptPath, ...scriptArgs] };
    }
    return { executable: explicit, args: [scriptPath, ...scriptArgs] };
  }

  if (process.platform === 'win32') {
    for (const p of commonWindowsPythonPaths()) {
      if (exists(p)) {
        return { executable: p, args: [scriptPath, ...scriptArgs] };
      }
    }
    const fromWhere = tryWhereOnWindows('python.exe') || tryWhereOnWindows('python');
    if (fromWhere) {
      return { executable: fromWhere, args: [scriptPath, ...scriptArgs] };
    }
    const pyLauncher = tryWhereOnWindows('py.exe') || tryWhereOnWindows('py');
    if (pyLauncher) {
      return { executable: pyLauncher, args: ['-3', scriptPath, ...scriptArgs] };
    }
  } else {
    try {
      const p = execSync('command -v python3 || command -v python', {
        encoding: 'utf8',
        shell: '/bin/sh',
      })
        .trim()
        .split('\n')[0];
      if (p && exists(p)) {
        return { executable: p, args: [scriptPath, ...scriptArgs] };
      }
    } catch {
      // fall through
    }
  }

  throw new Error(
    'Python not found. Set PYTHON_PATH to your python.exe (e.g. C:\\\\Program Files\\\\Python310\\\\python.exe), ' +
      'or install Python 3 and add it to the system PATH.',
  );
}
