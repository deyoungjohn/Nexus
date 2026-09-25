#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
memory_dir="$project_root/.agent-memory"

mkdir -p "$memory_dir"
export MEMORY_FILE_PATH="$memory_dir/memory.jsonl"

server_bin="$project_root/node_modules/.bin/mcp-server-memory"

if [[ ! -x "$server_bin" ]]; then
  echo "Project memory server is not installed. Run 'npm ci' in $project_root." >&2
  exit 1
fi

exec "$server_bin"
