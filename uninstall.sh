#!/usr/bin/env bash
# 仅取消所选 Profile，保留插件/配置备份；支持 --profile、--dsh-home。
set -euo pipefail
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$source_dir/tools/install_profile.py" --uninstall "$@"
