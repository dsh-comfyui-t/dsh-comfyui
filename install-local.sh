#!/usr/bin/env bash
# 本地安装：支持 --profile、--dsh-home，保留旧配置；不自动安装翻译组件。
set -euo pipefail
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$source_dir/tools/install_profile.py" --skip-translation "$@"
