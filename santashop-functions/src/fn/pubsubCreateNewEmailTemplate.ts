import {
	CreateTemplateCommand,
	SESClient,
	SESClientConfig,
} from '@aws-sdk/client-ses';
import * as fileSystem from 'fs/promises';

const region = 'us-west-2';
const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
let sesClient: SESClient | undefined = undefined;

const loadTemplate = async (): Promise<string> => {
	return await fileSystem.readFile(
		'src/utility/assets/registration-confirmation-2023.html',
		{ encoding: 'utf-8' },
	);
};

const createCreateTemplateCommand =
	async (): Promise<CreateTemplateCommand> => {
		const template = await loadTemplate();
		const cleanedUpTemplate = template.replace(/(\r\n|\n|\r|\t)/gm, '');

		return new CreateTemplateCommand({
			Template: {
				TemplateName: 'dscs-registration-confirmation-v1',
				HtmlPart: cleanedUpTemplate,
				SubjectPart:
					// eslint-disable-next-line quotes
					"Here's your ticket for the 2024 Denver Santa Claus Shop!",
			},
		});
	};

export default async (): Promise<void> => {
	if (!sesClient)
		sesClient = new SESClient({ credentials, region } as SESClientConfig);

	const createTemplateCommand = await createCreateTemplateCommand();

	try {
		await sesClient.send(createTemplateCommand);
		Promise.resolve();
	} catch (err) {
		console.error('Failed to create template.', err);
		Promise.reject(err);
	}
};
