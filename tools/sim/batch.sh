#!/usr/bin/env bash
# Run a list of sim jobs in parallel. Each line of the job file: <variant> <policy> <days> <seed> [strategy]
#   tools/sim/batch.sh jobs.txt out_dir [parallel]
set -u
JOBS=$1; OUT=$2; PAR=${3:-4}
mkdir -p "$OUT/logs"
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
run() {
  read -r variant policy days seed strategy <<<"$1"
  tag="$variant-$policy${strategy:+-$strategy}-${days}d"
  [ -f "$OUT/$tag-s$seed.json" ] && exit 0
  src="$ROOT/src"; [ "$variant" != baseline ] && src="$ROOT/.sim/variants/$variant/src"
  cd "$ROOT" && SIM_SRC="$src" SIM_VARIANT="$variant" npx vite-node tools/sim/run.ts -- --policy "$policy" --days "$days" --seed "$seed" ${strategy:+--strategy $strategy} --tag "$tag" --out "$OUT" --progress 10 > "$OUT/logs/$tag-s$seed.log" 2>&1
}
export -f run; export OUT ROOT
grep -v '^\s*#' "$JOBS" | grep -v '^\s*$' | xargs -P "$PAR" -I{} bash -c 'run "$@"' _ {}
