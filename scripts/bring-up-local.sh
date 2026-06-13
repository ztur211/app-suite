#!/usr/bin/env bash
# One-command local single-machine bring-up for the Things suite.
#
# Runs the whole stack on this Linux box, reachable in a browser over local
# HTTPS (Caddy's internal CA), and leaves you attached to a `things` tmux
# session: the bring-up runs INSIDE tmux so a dropped SSH connection doesn't
# kill the build. This is the scripted form of infra/README "Local
# single-machine deploy" + plan Task 10.
#
# Usage (from anywhere in the repo checkout):
#   scripts/bring-up-local.sh            # bootstrap + build-if-needed + up + attach
#   scripts/bring-up-local.sh --rebuild  # force a full image rebuild first
#   scripts/bring-up-local.sh --down     # stop the stack (keep volumes) + kill session
#
# What it does, in order:
#   1. preflight  — require docker/compose v2/tmux/openssl/git
#   2. infra/.env — generate it (local domain + fresh hex secrets) if absent;
#                   an existing .env is never touched
#   3. /etc/hosts — add the *.things.test hostnames (sudo) if missing
#   4. tmux       — build images (if missing), `compose up -d`, wait healthy,
#                   trust Caddy's local CA, print URLs — all in a monitored
#                   tmux session you end up attached to
#
# NOTE on secrets: they are generated once and frozen in infra/.env. Postgres
# creates its per-app roles from those values on FIRST volume init, and the
# DATABASE_URLs reference the same values — so if you ever regenerate infra/.env
# you must also wipe the DB volume (`docker compose ... down -v`) or the new
# passwords won't match the existing roles.
set -euo pipefail

# --- paths + constants -------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="things"
ENV_FILE="${ENV_FILE:-${ROOT}/infra/.env}"
ENV_EXAMPLE="${ENV_EXAMPLE:-${ROOT}/infra/.env.example}"
CA_OUT="${ROOT}/caddy-local-ca.crt"
SCRIPT_ABS="${ROOT}/scripts/$(basename "${BASH_SOURCE[0]}")"

# Single source of truth for the compose invocation — identical in every pane
# (project `things`, prod base + local overlay, local env file).
COMPOSE_CMD="docker compose -p ${SESSION} -f ${ROOT}/infra/docker-compose.prod.yml -f ${ROOT}/infra/docker-compose.local.yml --env-file ${ENV_FILE}"

REBUILD="${REBUILD:-0}"
DOWN=0

# Apps, mirroring scripts/build-local.sh. WEB_APPS get a public URL each.
ALL_IMAGES=(api-auth api-do api-say api-buy api-eat api-send web-do web-say web-buy web-eat web-send)
WEB_APPS=(do say buy eat send)

usage() {
  # Print the leading comment block (line 2 up to the first non-comment line),
  # with the leading "# " stripped — so the header doc stays the single source.
  awk 'NR==1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "${SCRIPT_ABS}"
}

# --- small helpers -----------------------------------------------------------
# Read a KEY=value from infra/.env (value may contain '=').
read_env() { grep -E "^$1=" "${ENV_FILE}" 2>/dev/null | head -n1 | cut -d= -f2- || true; }

# Replace (or append) a KEY=value line in infra/.env. Uses awk+ENVIRON so the
# value is treated literally (no sed delimiter / regex surprises).
set_env() {
  local key="$1" val="$2" tmp="${ENV_FILE}.tmp"
  KEY="${key}" VAL="${val}" awk '
    BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VAL"]; seen = 0 }
    $0 ~ "^" k "=" { print k "=" v; seen = 1; next }
    { print }
    END { if (!seen) print k "=" v }
  ' "${ENV_FILE}" > "${tmp}"
  mv "${tmp}" "${ENV_FILE}"
}

# --- phase 1: preflight ------------------------------------------------------
preflight_tools() {
  local missing=0 t
  for t in docker tmux openssl git; do
    if ! command -v "${t}" >/dev/null 2>&1; then
      echo "!! missing required tool: ${t}" >&2
      missing=1
    fi
  done
  if ! docker compose version >/dev/null 2>&1; then
    echo "!! 'docker compose' (Compose v2) is not available" >&2
    missing=1
  fi
  if [[ "${missing}" == "1" ]]; then
    echo "Install the missing tool(s) and re-run." >&2
    exit 1
  fi
}

# --- phase 2: infra/.env -----------------------------------------------------
bootstrap_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    echo "==> infra/.env exists — leaving it untouched"
    return 0
  fi
  if [[ ! -f "${ENV_EXAMPLE}" ]]; then
    echo "!! ${ENV_EXAMPLE} not found — cannot generate infra/.env" >&2
    exit 1
  fi
  echo "==> generating infra/.env (local defaults + fresh secrets)"
  local oldmask; oldmask="$(umask)"
  umask 077                 # keep the secret-bearing file + set_env temp files private from birth
  cp "${ENV_EXAMPLE}" "${ENV_FILE}"

  # Local single-machine values.
  set_env THINGS_DOMAIN things.test
  set_env AUTH_COOKIE_DOMAIN .things.test
  set_env CADDY_EXTRA_GLOBAL local_certs

  # Strong, URL/SQL/shell-safe secrets. hex (not base64) because these land in
  # `postgresql://user:PASS@...` URLs and `CREATE ROLE ... PASSWORD 'PASS'`,
  # where base64's '+ / =' would corrupt the value.
  local k
  for k in POSTGRES_PASSWORD AUTH_OWNER_PASSWORD DO_OWNER_PASSWORD \
           SAY_OWNER_PASSWORD BUY_OWNER_PASSWORD EAT_OWNER_PASSWORD \
           SEND_OWNER_PASSWORD AUTH_READER_PASSWORD BETTER_AUTH_SECRET \
           SERVICE_TOKEN_SECRET; do
    set_env "${k}" "$(openssl rand -hex 32)"
  done

  chmod 600 "${ENV_FILE}"   # set_env writes via a temp file + mv, which can reset the mode
  umask "${oldmask}"
  echo "    wrote ${ENV_FILE} (chmod 600; THINGS_DOMAIN=things.test, secrets randomized)"
  echo "    AI keys left as placeholders — set OPENAI_API_KEY / ANTHROPIC_API_KEY for api-say features."
}

# --- phase 3: /etc/hosts -----------------------------------------------------
setup_hosts() {
  local domain marker line
  domain="$(read_env THINGS_DOMAIN)"; domain="${domain:-things.test}"
  marker="# things-suite local deploy (${domain})"
  line="127.0.0.1 auth.${domain} api.do.${domain} api.say.${domain} api.buy.${domain} api.eat.${domain} api.send.${domain} do.${domain} say.${domain} buy.${domain} eat.${domain} send.${domain}"
  if grep -qF "auth.${domain}" /etc/hosts 2>/dev/null; then
    echo "==> /etc/hosts already maps ${domain} subdomains"
    return 0
  fi
  echo "==> adding ${domain} hostnames to /etc/hosts (sudo)"
  printf '%s\n%s\n' "${marker}" "${line}" | sudo tee -a /etc/hosts >/dev/null
  echo "    added 11 hostnames -> 127.0.0.1"
}

# --- phase 4 (inner, runs inside the tmux pane) ------------------------------
# Build all images if any are missing (or REBUILD=1).
maybe_build() {
  local registry tag missing=0 app
  registry="$(read_env REGISTRY)"; registry="${registry:-ghcr.io/ztur211}"
  tag="$(read_env TAG)"; tag="${tag:-latest}"
  if [[ "${REBUILD}" == "1" ]]; then
    echo "==> --rebuild: building all images"
    bash "${ROOT}/scripts/build-local.sh"
    return 0
  fi
  for app in "${ALL_IMAGES[@]}"; do
    if ! docker image inspect "${registry}/things-${app}:${tag}" >/dev/null 2>&1; then
      echo "    image missing: things-${app}:${tag}"
      missing=1
    fi
  done
  if [[ "${missing}" == "1" ]]; then
    echo "==> some images missing — building all (this is the slow part)"
    bash "${ROOT}/scripts/build-local.sh"
  else
    echo "==> all images present — skipping build (use --rebuild to force)"
  fi
}

# Poll until every container is healthy (or running, for ones without a
# healthcheck). Best-effort: returns non-zero on timeout but never aborts.
wait_healthy() {
  local tries=18 i=0 ids cid status total bad
  while (( i < tries )); do
    # shellcheck disable=SC2086
    ids="$(${COMPOSE_CMD} ps -q 2>/dev/null)"
    total=0; bad=0
    if [[ -n "${ids}" ]]; then
      while read -r cid; do
        [[ -z "${cid}" ]] && continue
        total=$((total + 1))
        status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${cid}" 2>/dev/null || echo missing)"
        case "${status}" in
          healthy|running) ;;
          *) bad=$((bad + 1)) ;;
        esac
      done <<< "${ids}"
      if (( total > 0 && bad == 0 )); then
        echo "==> all ${total} containers healthy/running"
        return 0
      fi
      echo "    $((total - bad))/${total} ready — waiting ($((i + 1))/${tries})…"
    else
      echo "    no containers yet — waiting ($((i + 1))/${tries})…"
    fi
    i=$((i + 1))
    sleep 10
  done
  echo "==> WARNING: not everything healthy after $((tries * 10))s — see the logs pane." >&2
  return 1
}

# Extract Caddy's internal-CA root and trust it (best-effort, common distros).
trust_ca() {
  echo "==> trusting Caddy's local CA"
  # shellcheck disable=SC2086
  if ! ${COMPOSE_CMD} cp caddy:/data/caddy/pki/authorities/local/root.crt "${CA_OUT}" 2>/dev/null; then
    echo "    !! couldn't copy the CA from caddy yet — skip; re-run once caddy is healthy." >&2
    return 0
  fi
  echo "    wrote ${CA_OUT}"
  if command -v update-ca-certificates >/dev/null 2>&1; then
    if sudo cp "${CA_OUT}" /usr/local/share/ca-certificates/things-local-ca.crt \
       && sudo update-ca-certificates >/dev/null 2>&1; then
      echo "    trusted system-wide (update-ca-certificates — Debian/Ubuntu)"
    fi
  elif command -v update-ca-trust >/dev/null 2>&1; then
    if sudo cp "${CA_OUT}" /etc/pki/ca-trust/source/anchors/things-local-ca.crt \
       && sudo update-ca-trust 2>/dev/null; then
      echo "    trusted system-wide (update-ca-trust — RHEL/Fedora)"
    fi
  elif command -v trust >/dev/null 2>&1; then
    sudo trust anchor "${CA_OUT}" 2>/dev/null && echo "    trusted system-wide (trust anchor — Arch)"
  else
    echo "    !! no known system trust tool — manually trust ${CA_OUT}." >&2
  fi
  echo "    NOTE: browsers (Chrome/Firefox) keep their OWN trust store. If you"
  echo "    still see a cert warning, import ${CA_OUT} in the browser, or set"
  echo "    Firefox security.enterprise_roots.enabled=true to use the system store."
}

print_status() {
  local domain cookie app
  domain="$(read_env THINGS_DOMAIN)"; domain="${domain:-things.test}"
  cookie="$(read_env AUTH_COOKIE_DOMAIN)"; cookie="${cookie:-.${domain}}"
  echo ""
  echo "================================================================"
  echo " Things local stack is up. Open (after trusting the CA above):"
  for app in "${WEB_APPS[@]}"; do
    printf "     https://%s.%s\n" "${app}" "${domain}"
  done
  echo "     (https://auth.${domain} is the auth API only — no page to open there)"
  echo ""
  echo " Acceptance (plan Task 10) — validate cross-subdomain login:"
  echo "   1. Open https://do.${domain} — it redirects to the login screen."
  echo "      The DB starts empty, so choose \"Sign up\" and create an account"
  echo "      (that signs you in). You land in Do Things, and its calls to"
  echo "      https://api.do.${domain} should succeed (check the network tab)."
  echo "   2. In the SAME browser, open https://say.${domain} — you should be"
  echo "      ALREADY authenticated, with no second sign-in. That proves the"
  echo "      session cookie (scoped to ${cookie}) is shared across subdomains."
  echo ""
  echo " Panes:  [left] this shell   [top-right] health   [bottom-right] logs"
  echo " Tear down later:  scripts/bring-up-local.sh --down"
  echo "================================================================"
}

run_bringup() {
  cd "${ROOT}"
  maybe_build
  echo "==> starting stack (docker compose up -d)"
  # shellcheck disable=SC2086
  ${COMPOSE_CMD} up -d --remove-orphans
  wait_healthy || echo "    (continuing despite unhealthy services — inspect the logs pane)"
  trust_ca || true
  print_status
}

# --- teardown ----------------------------------------------------------------
do_down() {
  echo "==> tearing down (containers + network; DB volumes kept)"
  # shellcheck disable=SC2086
  ${COMPOSE_CMD} down --remove-orphans || true
  if tmux has-session -t "${SESSION}" 2>/dev/null; then
    tmux kill-session -t "${SESSION}" && echo "    killed tmux session '${SESSION}'"
  fi
  echo "    done. To also wipe the database volumes:  ${COMPOSE_CMD} down -v"
}

# --- tmux orchestration (outer) ----------------------------------------------
launch_tmux() {
  if tmux has-session -t "${SESSION}" 2>/dev/null; then
    echo "==> tmux session '${SESSION}' already running — attaching."
    echo "    (to rebuild/restart: scripts/bring-up-local.sh --down, then re-run)"
    attach_session
    return 0
  fi
  echo "==> launching tmux session '${SESSION}' — bring-up runs inside it"

  # Main pane: run the inner bring-up, then drop to an interactive shell so the
  # pane stays usable for troubleshooting even if the bring-up errors.
  local inner_cmd health_cmd logs_cmd main_pane watch_pane
  inner_cmd="$(printf 'THINGS_BRINGUP_INNER=1 REBUILD=%q bash %q; exec bash -l' "${REBUILD}" "${SCRIPT_ABS}")"
  health_cmd="while true; do printf '\033[H\033[2J'; ${COMPOSE_CMD} ps; sleep 5; done; exec bash -l"
  logs_cmd="${COMPOSE_CMD} logs -f --tail=80; exec bash -l"

  main_pane="$(tmux new-session -d -s "${SESSION}" -n things -P -F '#{pane_id}' "${inner_cmd}")"
  watch_pane="$(tmux split-window -h -t "${main_pane}" -P -F '#{pane_id}' "${health_cmd}")"
  tmux split-window -v -t "${watch_pane}" "${logs_cmd}"
  tmux select-pane -t "${main_pane}"
  attach_session
}

# Attach, or switch if we're already inside a tmux client.
attach_session() {
  if [[ -n "${TMUX:-}" ]]; then
    tmux switch-client -t "${SESSION}"
  else
    exec tmux attach -t "${SESSION}"
  fi
}

parse_args() {
  local arg
  for arg in "$@"; do
    case "${arg}" in
      --rebuild) REBUILD=1 ;;
      --down)    DOWN=1 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "unknown argument: ${arg}" >&2; usage; exit 2 ;;
    esac
  done
}

main() {
  # Inner mode: we are already inside the tmux pane — just run the bring-up.
  if [[ "${THINGS_BRINGUP_INNER:-0}" == "1" ]]; then
    run_bringup
    return 0
  fi
  parse_args "$@"
  if [[ "${DOWN}" == "1" ]]; then
    do_down
    return 0
  fi
  preflight_tools
  bootstrap_env
  setup_hosts
  launch_tmux   # execs tmux attach; does not return on success
}

# Run main only when executed, not when sourced (so the helpers are unit-testable).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
