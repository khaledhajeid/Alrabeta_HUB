#!/usr/bin/env bash
# Generates real git repos into $1 (a scratch dir) to test runner.sh against
# actual git history, not synthetic JSON — same reason sandbox-io-match's
# fixtures are real scripts, not mocked interpreter output. Not copied into
# the Docker image; a dev-time/CI-time tool only. Each fixture gets a fake
# `refs/remotes/origin/<branch>` ref (via update-ref, no real remote needed)
# since that's the only thing runner.sh actually reads to resolve base_ref.
set -euo pipefail

OUT="${1:?usage: build-fixtures.sh <output-dir>}"
rm -rf "$OUT"
mkdir -p "$OUT"

make_repo() {
  local name="$1"
  local dir="$OUT/$name"
  mkdir -p "$dir"
  (
    cd "$dir"
    git init -q -b main
    git config user.email "fixture@example.com"
    git config user.name "Fixture"
    echo "init" > README.md
    git add README.md
    git commit -q -m "chore: init"
    git update-ref refs/remotes/origin/main main
  )
  echo "$dir"
}

# clean: 3 linear, conventional-format commits on top of main, no merges
d=$(make_repo clean)
(
  cd "$d"
  for msg in "feat: add parser" "feat: add validator" "fix: handle empty input"; do
    echo "$msg" >> work.txt
    git add work.txt
    git commit -q -m "$msg"
  done
)

# wrong-count: only 2 commits where a quest expects 3
d=$(make_repo wrong-count)
(
  cd "$d"
  for msg in "feat: add parser" "feat: add validator"; do
    echo "$msg" >> work.txt
    git add work.txt
    git commit -q -m "$msg"
  done
)

# has-merge: a real merge commit in the range
d=$(make_repo has-merge)
(
  cd "$d"
  git checkout -q -b feature
  echo "feat: on feature" >> work.txt
  git add work.txt
  git commit -q -m "feat: work on feature"
  git checkout -q main
  echo "chore: unrelated main work" >> other.txt
  git add other.txt
  git commit -q -m "chore: unrelated main work"
  git checkout -q feature
  git merge -q --no-edit main
  git checkout -q -b submission
)

# bad-message: a commit that doesn't match a conventional-commit pattern
d=$(make_repo bad-message)
(
  cd "$d"
  echo "feat: good commit" >> work.txt
  git add work.txt
  git commit -q -m "feat: good commit"
  echo "oops" >> work.txt
  git add work.txt
  git commit -q -m "wip forgot to write a real message"
)

echo "Fixtures built in $OUT"
for name in clean wrong-count has-merge bad-message; do
  sha=$(git -C "$OUT/$name" rev-parse HEAD)
  echo "  $name: HEAD=$sha"
done
