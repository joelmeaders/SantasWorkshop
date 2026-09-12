import { Injectable, effect, inject } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
type AlertOptions = NonNullable<Parameters<AlertController['create']>[0]>;
type LoadingOptions = NonNullable<Parameters<LoadingController['create']>[0]>;
import { AdminLanguageService } from './admin-language.service';

/** Re-evaluate translated copy without dismissing the dialog or losing its inputs. */
@Injectable({ providedIn: 'root' })
export class AdminAlertController extends AlertController {
	private readonly language = inject(AdminLanguageService);
	private readonly active = new Set<() => void>();
	constructor() {
		super();
		effect(() => {
			this.language.language();
			this.active.forEach((update) => update());
		});
	}
	public override create(
		options: AlertOptions = {},
	): Promise<HTMLIonAlertElement> {
		return this.createReactive(() => options);
	}
	public async createReactive(
		source: () => AlertOptions,
	): Promise<HTMLIonAlertElement> {
		const translate = (): AlertOptions => {
			const options = source();
			return {
				...options,
				header: options.header
					? this.language.text(options.header)
					: undefined,
				subHeader: options.subHeader
					? this.language.text(options.subHeader)
					: undefined,
				message:
					typeof options.message === 'string'
						? this.language.text(options.message)
						: options.message,
				buttons: (options.buttons ?? []).map((button) =>
					typeof button === 'string'
						? this.language.text(button)
						: { ...button, text: this.language.text(button.text) },
				),
				inputs: (options.inputs ?? []).map((input) => ({
					...input,
					label: input.label
						? this.language.text(input.label)
						: undefined,
					placeholder: input.placeholder
						? this.language.text(input.placeholder)
						: undefined,
				})),
			};
		};
		const alert = await super.create(translate());
		const update = (): void => {
			const options = translate();
			alert.header = options.header;
			alert.subHeader = options.subHeader;
			alert.message = options.message;
			alert.buttons = options.buttons ?? [];
			updateAlertInputLabels(alert, options.inputs ?? []);
		};
		this.active.add(update);
		void alert.onDidDismiss().then(() => this.active.delete(update));
		return alert;
	}
}

export function createAdminAlert(
	controller: AlertController,
	source: () => AlertOptions,
): Promise<HTMLIonAlertElement> {
	return controller instanceof AdminAlertController
		? controller.createReactive(source)
		: controller.create(source());
}

@Injectable({ providedIn: 'root' })
export class AdminLoadingController extends LoadingController {
	private readonly language = inject(AdminLanguageService);
	private readonly active = new Set<() => void>();
	constructor() {
		super();
		effect(() => {
			this.language.language();
			this.active.forEach((update) => update());
		});
	}
	public override async create(
		options: LoadingOptions = {},
	): Promise<HTMLIonLoadingElement> {
		const translated = (): typeof options.message =>
			typeof options.message === 'string'
				? this.language.text(options.message)
				: options.message;
		const loading = await super.create({
			...options,
			message: translated(),
		});
		const update = (): void => {
			loading.message = translated();
		};
		this.active.add(update);
		void loading.onDidDismiss().then(() => this.active.delete(update));
		return loading;
	}
}

/** Ionic stores pending values in rendered controls, separate from input options. */
export function updateAlertInputLabels(
	alert: HTMLIonAlertElement,
	labels: NonNullable<AlertOptions['inputs']>,
): void {
	const controls = Array.from(
		alert.querySelectorAll<
			HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
		>('.alert-input, [role="checkbox"], [role="radio"]'),
	);
	alert.inputs = alert.inputs.map((input, index) => {
		const control = controls[index];
		const checkable = input.type === 'checkbox' || input.type === 'radio';
		return {
			...input,
			...(control && checkable
				? { checked: control.getAttribute('aria-checked') === 'true' }
				: {}),
			...(control && !checkable ? { value: control.value } : {}),
			label: labels[index]?.label,
			placeholder: labels[index]?.placeholder,
		};
	});
}
