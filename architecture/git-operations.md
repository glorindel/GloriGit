# Git Operations SOP

## Overview
All git operations are executed via `child_process.execFile('git', [...args])`. This bypasses the shell entirely, preventing command injection.

## Command Reference

### Status
```
git status --porcelain=v2 --branch
```
- Returns machine-readable status with branch info
- XY codes: M=Modified, A=Added, D=Deleted, R=Renamed, ?=Untracked

### Log
```
git log --format={"hash":"%H",...} --max-count=N --skip=N
```
- JSON format per line
- Paginated with count/skip

### Diff
```
git diff [--cached] -- <file>
```
- `--cached` for staged changes
- Parse unified diff format into structured hunks

### Branch Operations
```
git branch -a --format=%(refname:short) %(HEAD)
git checkout <branch>
git checkout -b <name> [startPoint]
git branch -d|-D <name>
```

### Stage/Unstage
```
git add -- <files...>
git reset HEAD -- <files...>
```

### Commit/Push/Pull
```
git commit -m "<message>"
git push <remote> [branch]
git pull <remote> [branch]
```

## Edge Cases
- `git diff` returns exit code 1 when differences exist (not an error)
- `git diff --no-index /dev/null <file>` for untracked file content
- Empty repos may not have HEAD — handle gracefully
- Branch names can contain `/` (e.g., `feature/login`)
- Commit messages may contain special characters — use `-m` flag (not stdin)

## Security
- NEVER use `exec()` — always `execFile()` to prevent shell injection
- All file paths come from git output, not user input
- Server only binds to 127.0.0.1 (localhost)
