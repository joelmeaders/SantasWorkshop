import { initializeApp, getApps } from 'firebase/app';
import {
	connectFunctionsEmulator,
	type Functions,
	getFunctions,
	httpsCallable,
} from 'firebase/functions';
import firebaseConfig from '../../../firebase.environment.test.json';
import { FUNCTION_REGION } from '../../src/utility/function-region';

let functionsClient: Functions | undefined;

const getFunctionsClient = () => {
	if (functionsClient) {
		return functionsClient;
	}

	const app = getApps()[0] ?? initializeApp(firebaseConfig);
	functionsClient = getFunctions(app, FUNCTION_REGION);
	connectFunctionsEmulator(functionsClient, '127.0.0.1', 5001);
	return functionsClient;
};

export const callCallable = async <TResult, TData = unknown>(
	functionName: string,
	data?: TData,
): Promise<TResult> => {
	const callable = httpsCallable<TData, TResult>(
		getFunctionsClient(),
		functionName,
	);
	const result = await callable(data as TData);
	return result.data;
};
