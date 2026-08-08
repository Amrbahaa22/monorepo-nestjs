import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnModuleDestroy,
} from "@nestjs/common";
import { Kafka, Partitioners, type Producer } from "kafkajs";
import { KafkaEventPublisher } from "./kafka-event-publisher";

export const KAFKA_CLIENT = Symbol("KAFKA_CLIENT");
export const KAFKA_PRODUCER = Symbol("KAFKA_PRODUCER");
export const EVENT_PUBLISHER = Symbol("EVENT_PUBLISHER");

export interface KafkaModuleOptions {
  readonly clientId: string;
  /**
   * Omit to read KAFKA_BROKERS at DI time. Never pass a value computed inside a
   * decorator argument — that is evaluated at import time, before env is loaded.
   */
  readonly brokers?: readonly string[] | (() => readonly string[]);
}

function resolveBrokers(brokers: KafkaModuleOptions["brokers"]): string[] {
  if (typeof brokers === "function") {
    return [...brokers()];
  }
  if (brokers !== undefined) {
    return [...brokers];
  }
  return (process.env.KAFKA_BROKERS ?? "localhost:9092").split(",");
}

@Global()
@Module({})
export class KafkaModule implements OnModuleDestroy {
  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: Producer) {}

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  static forRoot(options: KafkaModuleOptions): DynamicModule {
    return {
      module: KafkaModule,
      providers: [
        {
          provide: KAFKA_CLIENT,
          useFactory: () =>
            new Kafka({
              clientId: options.clientId,
              brokers: resolveBrokers(options.brokers),
            }),
        },
        {
          provide: KAFKA_PRODUCER,
          inject: [KAFKA_CLIENT],
          useFactory: async (kafka: Kafka): Promise<Producer> => {
            const producer = kafka.producer({
              idempotent: true,
              createPartitioner: Partitioners.DefaultPartitioner,
            });
            await producer.connect();
            return producer;
          },
        },
        {
          provide: EVENT_PUBLISHER,
          inject: [KAFKA_PRODUCER],
          useFactory: (producer: Producer) => new KafkaEventPublisher(producer),
        },
      ],
      exports: [KAFKA_CLIENT, KAFKA_PRODUCER, EVENT_PUBLISHER],
    };
  }
}
