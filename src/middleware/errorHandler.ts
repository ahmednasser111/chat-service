import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { ZodError } from "zod";

export const errorHandler = (
	error: Error,
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	logger.error("Error:", error);

	if (error instanceof ZodError) {
		res.status(400).json({
			error: "Validation error",
			details: error.errors,
		});
		return;
	}

	res.status(500).json({
		error: "Internal server error",
		message: process.env.NODE_ENV === "development" ? error.message : undefined,
	});
};
