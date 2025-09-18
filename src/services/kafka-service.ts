import { Kafka, Producer, Consumer, EachMessagePayload } from "kafkajs";
import { logger } from "../utils/logger";
import prismaClient from "../config/database";

export class KafkaService {
	private static instance: KafkaService;
	private kafka: Kafka;
	private producer: Producer | null = null;
	private consumer: Consumer | null = null;

	private constructor() {
		this.kafka = new Kafka({
			clientId: "chat-backend",
			brokers: [process.env.KAFKA_BROKER || "localhost:9094"],
			ssl:
				process.env.KAFKA_SSL === "true"
					? {
							rejectUnauthorized: false,
					  }
					: undefined,
			sasl: process.env.KAFKA_USERNAME
				? {
						mechanism: "plain",
						username: process.env.KAFKA_USERNAME,
						password: process.env.KAFKA_PASSWORD || "",
				  }
				: undefined,
		});
	}

	static getInstance(): KafkaService {
		if (!KafkaService.instance) {
			KafkaService.instance = new KafkaService();
		}
		return KafkaService.instance;
	}

	async connect(): Promise<void> {
		try {
			this.producer = this.kafka.producer();
			this.consumer = this.kafka.consumer({ groupId: "chat-group" });

			await this.producer.connect();
			await this.consumer.connect();

			logger.info("Kafka connected");
		} catch (error) {
			logger.error("Kafka connection failed:", error);
			throw error;
		}
	}

	async produceMessage(topic: string, message: any): Promise<void> {
		if (!this.producer) throw new Error("Kafka producer not initialized");

		await this.producer.send({
			topic,
			messages: [
				{
					key: `message-${Date.now()}`,
					value: JSON.stringify(message),
				},
			],
		});
	}

	async startConsumer(): Promise<void> {
		if (!this.consumer) throw new Error("Kafka consumer not initialized");

		await this.consumer.subscribe({ topic: "MESSAGES", fromBeginning: false });

		await this.consumer.run({
			eachMessage: async ({ message, pause }: EachMessagePayload) => {
				try {
					if (!message.value) return;

					const messageData = JSON.parse(message.value.toString());
					logger.info("Processing message from Kafka:", messageData);

					// Save to database
					await prismaClient.message.create({
						data: {
							text: messageData.text,
							userId: messageData.userId,
							roomId: messageData.roomId,
						},
					});
				} catch (error) {
					logger.error("Error processing Kafka message:", error);
					pause();
					setTimeout(() => {
						this.consumer?.resume([{ topic: "MESSAGES" }]);
					}, 60000);
				}
			},
		});

		logger.info("Kafka consumer started");
	}

	async disconnect(): Promise<void> {
		await this.producer?.disconnect();
		await this.consumer?.disconnect();
		logger.info("Kafka disconnected");
	}
}
