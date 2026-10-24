#!/usr/bin/env bash
# Runs the load-test ladder against STAGING and writes one summary per stage
# to .data/results/. Seed first (see README.md). Usage:
#
#   scripts/loadtest/run.sh applicant   # 50, 100, 200, 400, 800 concurrent applicants
#   scripts/loadtest/run.sh spike       # 500, 2000, 3500, 5000 status-page loads in ~1 minute
#   scripts/loadtest/run.sh organizer   # 1, 5, 20 organizers refreshing the console
#   scripts/loadtest/run.sh signin      # password sign-ins from one IP (Auth rate limit)
#
# A stage aborts once more than 5% of its requests fail (k6 exit code 99),
# and the ladder stops there.
set -u
cd "$(dirname "$0")"
mkdir -p .data/results

stage() {
  local name=$1; shift
  echo "=== $name ($(date +%H:%M:%S))"
  k6 run --quiet --summary-export ".data/results/$name.json" "$@" portal.js > ".data/results/$name.txt" 2>&1
  local code=$?
  grep -E "http_req_failed\.|http_reqs\.|iterations\.|http_req_duration\.\.\." ".data/results/$name.txt" | sed 's/^/  /'
  if [ $code -eq 99 ]; then echo "  -> aborted: more than 5% of requests failed"; return 1; fi
  if [ $code -ne 0 ]; then echo "  -> k6 exited $code (see .data/results/$name.txt)"; fi
  return 0
}

case "${1:-}" in
  applicant)
    for vus in ${VUS_LADDER:-50 100 200 400 800}; do
      node seed.mjs reset > /dev/null   # empty the insert slots so every insert is new
      stage "applicant-$vus" -e SCENARIO=applicant -e VUS="$vus" || break
      sleep 20
    done ;;
  spike)
    for users in ${USERS_LADDER:-500 2000 3500 5000}; do
      stage "spike-$users" -e SCENARIO=spike -e USERS="$users" || break
      sleep 20
    done ;;
  organizer)
    for vus in ${VUS_LADDER:-1 5 20}; do
      stage "organizer-$vus" -e SCENARIO=organizer -e VUS="$vus" -e EXPECT_ROWS="${EXPECT_ROWS:-1000}" || break
      sleep 10
    done ;;
  signin)
    stage "signin" -e SCENARIO=signin -e RATE="${RATE:-2}" -e HOLD="${HOLD:-60s}" ;;
  *)
    sed -n '2,11p' "$0"; exit 1 ;;
esac
