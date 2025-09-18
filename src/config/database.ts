import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prismaClient = new PrismaClient({
	log:
		process.env.NODE_ENV === "development"
			? ["query", "error", "warn"]
			: ["error"],
});

prismaClient
	.$connect()
	.then(() => logger.info("Database connected"))
	.catch((error) => {
		logger.error("Database connection failed:", error);
		process.exit(1);
	});

export default prismaClient;
