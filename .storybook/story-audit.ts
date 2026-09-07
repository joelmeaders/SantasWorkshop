interface StoryAudit {
	issues: string[];
	observer: MutationObserver;
	restore: (() => void)[];
}

let activeAudit: StoryAudit | undefined;

const resourceSelector = [
	'img[src]',
	'script[src]',
	'link[href]',
	'iframe[src]',
	'audio[src]',
	'video[src]',
	'source[src]',
	'source[srcset]',
	'object[data]',
	'embed[src]',
].join(',');

function describeValue(value: unknown): string {
	if (value instanceof Error) {
		return value.message;
	}
	if (typeof value === 'string') {
		return value;
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function recordIssue(message: string): void {
	activeAudit?.issues.push(message);
}

function isAllowedTarget(value: string | URL): boolean {
	try {
		const target = new URL(String(value), document.baseURI);
		if (['about:', 'blob:', 'data:'].includes(target.protocol)) {
			return true;
		}
		if (target.protocol === 'ws:' || target.protocol === 'wss:') {
			return target.host === window.location.host;
		}
		return target.origin === window.location.origin;
	} catch {
		return false;
	}
}

function checkTarget(kind: string, value: string | URL): boolean {
	if (isAllowedTarget(value)) {
		return true;
	}

	recordIssue(`${kind} attempted an external request: ${String(value)}`);
	return false;
}

function checkResource(element: Element): void {
	if (element.matches('link[href]')) {
		const rel = element.getAttribute('rel')?.toLowerCase() ?? '';
		const fetchedRelations = [
			'stylesheet',
			'icon',
			'preload',
			'modulepreload',
			'prefetch',
			'preconnect',
			'dns-prefetch',
		];
		if (
			!fetchedRelations.some((relation) =>
				rel.split(/\s+/u).includes(relation),
			)
		) {
			return;
		}
	}

	const attribute = element.matches('link[href]')
		? 'href'
		: element.matches('object[data]')
			? 'data'
			: element.hasAttribute('srcset')
				? 'srcset'
				: 'src';
	const rawValue = element.getAttribute(attribute);

	if (!rawValue) {
		return;
	}

	const values =
		attribute === 'srcset'
			? rawValue.split(',').map((entry) => entry.trim().split(/\s+/u)[0])
			: [rawValue];
	for (const value of values) {
		if (value) {
			checkTarget(
				`${element.tagName.toLowerCase()}[${attribute}]`,
				value,
			);
		}
	}
}

function checkResources(root: ParentNode): void {
	for (const element of root.querySelectorAll(resourceSelector)) {
		checkResource(element);
	}
}

function hasRenderedContent(root: HTMLElement): boolean {
	if (root.textContent?.trim()) {
		return true;
	}

	return Boolean(
		root.querySelector(
			'img, svg, canvas, video, audio, input, textarea, select, button, a[href], ion-icon, ion-spinner, ion-skeleton-text, [role], [aria-label]',
		),
	);
}

export function installStoryAudit(): () => void {
	const issues: string[] = [];
	const restore: (() => void)[] = [];
	const audit = {
		issues,
		restore,
		observer: new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === 'attributes' &&
					mutation.target instanceof Element
				) {
					checkResource(mutation.target);
				}
				for (const node of mutation.addedNodes) {
					if (node instanceof Element) {
						if (node.matches(resourceSelector)) {
							checkResource(node);
						}
						checkResources(node);
					}
				}
			}
		}),
	} satisfies StoryAudit;
	activeAudit = audit;

	const onPolicyViolation = (event: SecurityPolicyViolationEvent): void => {
		recordIssue(
			`Content security policy blocked ${event.violatedDirective}: ${event.blockedURI}`,
		);
	};
	document.addEventListener('securitypolicyviolation', onPolicyViolation);
	restore.push(() =>
		document.removeEventListener(
			'securitypolicyviolation',
			onPolicyViolation,
		),
	);

	// Scanner stories must not request a user's camera or enumerate real devices.
	if (navigator.mediaDevices) {
		const devices = navigator.mediaDevices;
		const originalGetUserMedia = devices.getUserMedia;
		const originalEnumerateDevices = devices.enumerateDevices;
		devices.getUserMedia = async (): Promise<MediaStream> => {
			recordIssue(
				'A story requested camera or microphone access. Mock the scanner state instead.',
			);
			throw new DOMException(
				'Device access is disabled in Storybook.',
				'NotAllowedError',
			);
		};
		devices.enumerateDevices = async (): Promise<MediaDeviceInfo[]> => [];
		restore.push(() => {
			devices.getUserMedia = originalGetUserMedia;
			devices.enumerateDevices = originalEnumerateDevices;
		});
	}

	const onError = (event: ErrorEvent): void => {
		recordIssue(
			`Runtime error: ${event.error instanceof Error ? event.error.message : event.message}`,
		);
	};
	const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
		recordIssue(
			`Unhandled promise rejection: ${describeValue(event.reason)}`,
		);
	};
	window.addEventListener('error', onError);
	window.addEventListener('unhandledrejection', onUnhandledRejection);
	restore.push(() => window.removeEventListener('error', onError));
	restore.push(() =>
		window.removeEventListener('unhandledrejection', onUnhandledRejection),
	);

	const originalConsoleError = console.error;
	console.error = (...values: unknown[]): void => {
		recordIssue(`Console error: ${values.map(describeValue).join(' ')}`);
		originalConsoleError(...values);
	};
	restore.push(() => {
		console.error = originalConsoleError;
	});

	const originalFetch = window.fetch;
	window.fetch = (async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const target = input instanceof Request ? input.url : input;
		if (!checkTarget('fetch', target)) {
			throw new Error(
				`Storybook blocked an external fetch request to ${String(target)}.`,
			);
		}
		return originalFetch(input, init);
	}) as typeof window.fetch;
	restore.push(() => {
		window.fetch = originalFetch;
	});

	const originalXhrOpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (
		this: XMLHttpRequest,
		...args: Parameters<XMLHttpRequest['open']>
	): void {
		if (!checkTarget('XMLHttpRequest', args[1])) {
			throw new Error(
				`Storybook blocked an external XMLHttpRequest to ${String(args[1])}.`,
			);
		}
		originalXhrOpen.apply(this, args);
	} as XMLHttpRequest['open'];
	restore.push(() => {
		XMLHttpRequest.prototype.open = originalXhrOpen;
	});

	const originalWebSocket = window.WebSocket;
	window.WebSocket = new Proxy(originalWebSocket, {
		construct(
			target,
			args: ConstructorParameters<typeof WebSocket>,
		): WebSocket {
			if (!checkTarget('WebSocket', args[0])) {
				throw new Error(
					`Storybook blocked an external WebSocket connection to ${String(args[0])}.`,
				);
			}
			return Reflect.construct(target, args);
		},
	});
	restore.push(() => {
		window.WebSocket = originalWebSocket;
	});

	const originalEventSource = window.EventSource;
	window.EventSource = new Proxy(originalEventSource, {
		construct(
			target,
			args: ConstructorParameters<typeof EventSource>,
		): EventSource {
			if (!checkTarget('EventSource', args[0])) {
				throw new Error(
					`Storybook blocked an external EventSource connection to ${String(args[0])}.`,
				);
			}
			return Reflect.construct(target, args);
		},
	});
	restore.push(() => {
		window.EventSource = originalEventSource;
	});

	const originalSendBeacon = navigator.sendBeacon.bind(navigator);
	navigator.sendBeacon = (
		url: string | URL,
		data?: BodyInit | null,
	): boolean => {
		if (!checkTarget('sendBeacon', url)) {
			return false;
		}
		return originalSendBeacon(url, data);
	};
	restore.push(() => {
		navigator.sendBeacon = originalSendBeacon;
	});

	const originalWindowOpen = window.open;
	window.open = ((
		url?: string | URL,
		target?: string,
		features?: string,
	): Window | null => {
		if (url && !checkTarget('window.open', url)) {
			return null;
		}
		return originalWindowOpen.call(window, url, target, features);
	}) as typeof window.open;
	restore.push(() => {
		window.open = originalWindowOpen;
	});

	const onClick = (event: MouseEvent): void => {
		const anchor =
			event.target instanceof Element
				? event.target.closest('a[href]')
				: null;
		const href = anchor?.getAttribute('href');
		if (href && !isAllowedTarget(href)) {
			event.preventDefault();
			recordIssue(`Link click attempted external navigation: ${href}`);
		}
	};
	const onSubmit = (event: SubmitEvent): void => {
		const form =
			event.target instanceof HTMLFormElement ? event.target : undefined;
		if (form && !isAllowedTarget(form.action)) {
			event.preventDefault();
			recordIssue(
				`Form submission attempted external navigation: ${form.action}`,
			);
		}
	};
	document.addEventListener('click', onClick, true);
	document.addEventListener('submit', onSubmit, true);
	restore.push(() => document.removeEventListener('click', onClick, true));
	restore.push(() => document.removeEventListener('submit', onSubmit, true));

	audit.observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['src', 'srcset', 'href', 'data'],
		childList: true,
		subtree: true,
	});
	checkResources(document);

	return () => {
		audit.observer.disconnect();
		for (const restoreAction of restore.reverse()) {
			restoreAction();
		}
		if (activeAudit === audit) {
			activeAudit = undefined;
		}
	};
}

export function verifyStoryAudit(root: HTMLElement): void {
	checkResources(document);
	for (const content of root.querySelectorAll('ion-content')) {
		if (content.closest('.ion-page-hidden, [hidden]')) continue;
		const bounds = content.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) {
			recordIssue(
				'An Ionic content region has no visible area. Give the story a page-sized container.',
			);
		}
	}

	if (!hasRenderedContent(root)) {
		recordIssue('The story rendered no visible or accessible content.');
	}

	const issues = [...new Set(activeAudit?.issues ?? [])];
	if (issues.length > 0) {
		throw new Error(`Story validation failed:\n- ${issues.join('\n- ')}`);
	}
}
