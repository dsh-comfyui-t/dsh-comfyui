#!/usr/bin/env bash
# 自动发现 desktop/web 或版本化 Profile；多个自定义 Profile 用 --profile 指定。
# 保留已有配置与备份，安装器会执行 install_translation.py（失败不阻断主体）。
set -euo pipefail
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$source_dir/tools/install_profile.py" "$@"
