#!/bin/sh
set -eu

PERCENT="${MOVIES_MIGRATION_PERCENT:-0}"

# проверка что число
case "$PERCENT" in
  *[!0-9]*|"") echo "MOVIES_MIGRATION_PERCENT must be integer, got: $PERCENT" ; exit 1 ;;
esac

# clamp 0..100
if [ "$PERCENT" -lt 0 ]; then PERCENT=0; fi
if [ "$PERCENT" -gt 100 ]; then PERCENT=100; fi

MOVIES_WEIGHT="$PERCENT"
MONOLITH_WEIGHT=$((100 - PERCENT))

echo "Starting Kong with MOVIES_MIGRATION_PERCENT=$PERCENT (movies=$MOVIES_WEIGHT, monolith=$MONOLITH_WEIGHT)"

# подстановка в шаблон без sed -i (чтобы было переносимо)
sed \
  "s/{{MOVIES_WEIGHT}}/${MOVIES_WEIGHT}/g; s/{{MONOLITH_WEIGHT}}/${MONOLITH_WEIGHT}/g" \
  /etc/kong/kong.yml.template > /etc/kong/kong.yml

export KONG_DATABASE="${KONG_DATABASE:-off}"
export KONG_DECLARATIVE_CONFIG="${KONG_DECLARATIVE_CONFIG:-/etc/kong/kong.yml}"
export KONG_PROXY_LISTEN="${KONG_PROXY_LISTEN:-0.0.0.0:8000}"
export KONG_ADMIN_LISTEN="${KONG_ADMIN_LISTEN:-off}"

kong start
tail -f /usr/local/kong/logs/error.log
