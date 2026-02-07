#!/bin/bash
while true; do
  sleep 600  # 10 minutes
  cd /workspaces/lineremain
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "Auto-save: $(date '+%Y-%m-%d %H:%M:%S')"
    git push
    echo "Auto-saved at $(date)"
  fi
done
