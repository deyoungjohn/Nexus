#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."
# Never pass a key value as an argument. The CLI uses hidden local input or a private file.
exec npm run pilot:eoa -- "$@"
