#!/bin/bash
set -euo pipefail

BROKER="${KAFKA_BROKERS:-kafka:29092}"
PARTITIONS="${TOPIC_PARTITIONS:-3}"
CLI=/opt/kafka/bin/kafka-topics.sh

# Every base topic gets its full retry ladder: base, three tiers, dlq.
BASE_TOPICS=(
  payment.events.v1
  ledger.commands.v1
  ledger.events.v1
  risk.commands.v1
  risk.events.v1
  payout.commands.v1
  payout.events.v1
)

create() {
  "$CLI" --bootstrap-server "$BROKER" --create --if-not-exists \
    --topic "$1" --partitions "$PARTITIONS" --replication-factor 1
}

for base in "${BASE_TOPICS[@]}"; do
  for topic in "$base" "$base.retry.5s" "$base.retry.1m" "$base.retry.15m" "$base.dlq"; do
    create "$topic"
  done
done

# Reconcile is polled, never retried on a ladder.
create payout.reconcile.v1

echo "topics provisioned"
