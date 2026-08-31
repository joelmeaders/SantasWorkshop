export interface RegistrationEmail {
	code: string | undefined;
	qrCodeStoragePath: string;
	name: string | undefined;
	email: string | undefined;
	formattedDateTime: string | undefined;
}
