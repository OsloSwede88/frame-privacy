#!/bin/sh
# Fetch quiet-tizen (the temporary-root and backup toolkit this repo builds on) at the pinned,
# reviewed commit, apply the small Frame patch and add the Frame profile.
set -eu
cd "$(dirname "$0")"
QT_URL=https://github.com/jss8649/quiet-tizen.git
QT_COMMIT=cf518d7a9278dca7990e27756218258e44044a29
if [ ! -d quiet-tizen/.git ]; then git clone --quiet "$QT_URL" quiet-tizen; fi
cd quiet-tizen
git fetch --quiet origin
if git apply --reverse --check ../patches/quiet-tizen-frame.patch 2>/dev/null; then
    echo 'Frame patch already applied.'
else
    test -z "$(git status --porcelain --untracked-files=no)" || { echo 'quiet-tizen has other local changes; not touching it.' >&2; exit 1; }
    git checkout --quiet "$QT_COMMIT"
    git apply ../patches/quiet-tizen-frame.patch
fi
cp ../profiles/*.json profiles/
mkdir -p .local
echo "quiet-tizen ready at $(pwd) (commit $QT_COMMIT + Frame patch)."
echo 'Next: read AGENTS.md, then follow quiet-tizen/docs/02-access.md for Developer Mode and SDB.'
