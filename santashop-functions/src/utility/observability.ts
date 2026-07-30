import * as logger from 'firebase-functions/logger';
import type { CallableRequest } from 'firebase-functions/v2/https';
import {
	getErrorCode,
	getErrorMessage,
	getErrorStatus,
	serializeError,
} from './errors';

type TriggerType = 'callable' | 'firestore' | 'pubsub' | 'scheduled';

export interface StructuredLogMetadata {
	[key: string]: unknown;
}

type MetadataFactory<TArgument> = (
	argument: TArgument,
) => StructuredLogMetadata;

type AsyncHandler<TArgument, TResult> = (
	argument: TArgument,
) => Promise<TResult>;

interface FunctionLogger {
	debug: (message: string, metadata?: StructuredLogMetadata) => void;
	info: (message: string, metadata?: StructuredLogMetadata) => void;
	warn: (message: string, metadata?: StructuredLogMetadata) => void;
	error: (
		message: string,
		metadata?: StructuredLogMetadata,
		error?: unknown,
	) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const compactMetadata = (
	metadata: StructuredLogMetadata,
): StructuredLogMetadata => {
	return Object.fromEntries(
		Object.entries(metadata).filter(([, value]) => value !== undefined),
	);
};

const getObjectKeys = (value: unknown): string[] | undefined => {
	return isRecord(value)
		? Object.keys(value).sort((left, right) => left.localeCompare(right))
		: undefined;
};

const getString = (value: unknown): string | undefined => {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const getNestedRecord = (
	value: unknown,
	...path: string[]
): Record<string, unknown> | undefined => {
	let current: unknown = value;

	for (const key of path) {
		if (!isRecord(current)) {
			return undefined;
		}

		current = current[key];
	}

	return isRecord(current) ? current : undefined;
};

const buildCallableMetadata = (
	request: CallableRequest<unknown>,
): StructuredLogMetadata => {
	const authToken = isRecord(request.auth?.token) ? request.auth?.token : {};
	let dataType = typeof request.data;

	if (Array.isArray(request.data)) {
		dataType = 'array';
	} else if (request.data === null) {
		dataType = 'null';
	}

	return compactMetadata({
		authUid: request.auth?.uid ?? null,
		isAuthenticated: Boolean(request.auth?.uid),
		isAdmin: authToken['admin'] === true,
		dataType,
		dataKeys: getObjectKeys(request.data),
	});
};

const buildFirestoreMetadata = (event: unknown): StructuredLogMetadata => {
	const eventRecord = isRecord(event) ? event : {};
	const eventData = getNestedRecord(eventRecord, 'data');
	const documentRef = getNestedRecord(eventData, 'ref');

	return compactMetadata({
		eventId: getString(eventRecord['id']),
		paramKeys: getObjectKeys(eventRecord['params']),
		documentId: getString(eventData?.['id']),
		documentPath: getString(documentRef?.['path']),
	});
};

const buildScheduledMetadata = (event: unknown): StructuredLogMetadata => {
	const eventRecord = isRecord(event) ? event : {};

	return compactMetadata({
		eventId: getString(eventRecord['id']),
		scheduleTime:
			getString(eventRecord['scheduleTime']) ??
			getString(eventRecord['time']) ??
			getString(eventRecord['timestamp']),
	});
};

const buildPubsubMetadata = (event: unknown): StructuredLogMetadata => {
	const eventRecord = isRecord(event) ? event : {};
	const message = getNestedRecord(eventRecord, 'data', 'message');

	return compactMetadata({
		eventId: getString(eventRecord['id']),
		messageId: getString(message?.['messageId']),
		publishTime: getString(message?.['publishTime']),
		attributeKeys: getObjectKeys(message?.['attributes']),
	});
};

const buildErrorMetadata = (
	error: unknown,
): StructuredLogMetadata => {
	return compactMetadata({
		errorCode: getErrorCode(error),
		errorMessage: getErrorMessage(error),
		errorStatus: getErrorStatus(error),
		errorDetails: serializeError(error),
	});
};

const writeLog = (
	level: 'debug' | 'info' | 'warn' | 'error',
	message: string,
	metadata: StructuredLogMetadata,
): void => {
	switch (level) {
		case 'debug':
			logger.debug(message, metadata);
			return;

		case 'info':
			logger.info(message, metadata);
			return;

		case 'warn':
			logger.warn(message, metadata);
			return;

		case 'error':
			logger.error(message, metadata);
			return;
	}
	};

export const createFunctionLogger = (functionName: string): FunctionLogger => {
	const logWithLevel = (
		level: 'debug' | 'info' | 'warn' | 'error',
		message: string,
		metadata: StructuredLogMetadata = {},
		error?: unknown,
	): void => {
		writeLog(
			level,
			message,
			compactMetadata({
				functionName,
				...metadata,
				...(error === undefined ? {} : buildErrorMetadata(error)),
			}),
		);
	};

	return {
		debug: (message, metadata) => logWithLevel('debug', message, metadata),
		info: (message, metadata) => logWithLevel('info', message, metadata),
		warn: (message, metadata) => logWithLevel('warn', message, metadata),
		error: (message, metadata, error) =>
			logWithLevel('error', message, metadata, error),
	};
};

const observeHandler = <TArgument, TResult>(
	functionName: string,
	triggerType: TriggerType,
	metadataFactory: MetadataFactory<TArgument>,
	handler: AsyncHandler<TArgument, TResult>,
): AsyncHandler<TArgument, TResult> => {
	return async (argument: TArgument): Promise<TResult> => {
		const log = createFunctionLogger(functionName);
		const invocationMetadata = compactMetadata({
			triggerType,
			...metadataFactory(argument),
		});
		const startedAt = Date.now();

		log.info('Function invocation started', invocationMetadata);

		try {
			const result = await handler(argument);
			log.info('Function invocation succeeded', {
				...invocationMetadata,
				durationMs: Date.now() - startedAt,
			});
			return result;
		} catch (error) {
			log.error(
				'Function invocation failed',
				{
					...invocationMetadata,
					durationMs: Date.now() - startedAt,
				},
				error,
			);
			throw error;
		}
	};
};

export const observeCallableHandler = <TData, TResult>(
	functionName: string,
	handler: AsyncHandler<CallableRequest<TData>, TResult>,
): AsyncHandler<CallableRequest<TData>, TResult> => {
	return observeHandler(
		functionName,
		'callable',
		(request) => buildCallableMetadata(request as CallableRequest<unknown>),
		handler,
	);
};

export const observeDocumentHandler = <TEvent, TResult>(
	functionName: string,
	handler: AsyncHandler<TEvent, TResult>,
): AsyncHandler<TEvent, TResult> => {
	return observeHandler(functionName, 'firestore', buildFirestoreMetadata, handler);
};

export const observeScheduledHandler = <TEvent, TResult>(
	functionName: string,
	handler: AsyncHandler<TEvent, TResult>,
): AsyncHandler<TEvent, TResult> => {
	return observeHandler(functionName, 'scheduled', buildScheduledMetadata, handler);
};

export const observePubsubHandler = <TEvent, TResult>(
	functionName: string,
	handler: AsyncHandler<TEvent, TResult>,
): AsyncHandler<TEvent, TResult> => {
	return observeHandler(functionName, 'pubsub', buildPubsubMetadata, handler);
};