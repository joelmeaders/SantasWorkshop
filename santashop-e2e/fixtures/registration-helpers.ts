import { expect, type Locator, type Page } from '@playwright/test';

export interface TestChild {
	firstName: string;
	lastName: string;
	dateOfBirth: string;
	toyType: 'boys' | 'girls' | 'infants';
}

export const defaultTestChild = (
	overrides: Partial<TestChild> = {},
): TestChild => ({
	firstName: 'Rudolph',
	lastName: 'Tester',
	dateOfBirth: '2018-06-15',
	toyType: 'boys',
	...overrides,
});

const childForm = (page: Page): Locator =>
	page.locator('ion-modal form');

export const addChildViaUi = async (
	page: Page,
	child: TestChild,
): Promise<void> => {
	await page.goto('/pre-registration/overview#children');
	await page.locator('app-children-card [data-open-add-child]').click();
	const form = childForm(page);
	await expect(form).toBeVisible({ timeout: 15000 });
	await fillIonicInput(
		form.locator('ion-input[formControlName="firstName"]'),
		child.firstName,
	);
	await fillIonicInput(
		form.locator('ion-input[formControlName="lastName"]'),
		child.lastName,
	);
	await setBirthDate(
		form.locator('ion-input[formControlName="dateOfBirth"]'),
		child.dateOfBirth,
	);

	if (child.toyType === 'infants') {
		await expect(form.locator('ion-radio-group')).toHaveCount(0);
	} else {
		const toyType = form.locator(`ion-radio[value="${child.toyType}"]`);
		await expect(toyType).toBeVisible({ timeout: 10000 });
		await toyType.click();
	}

	const saveButton = form.locator('ion-button[type="submit"]');
	await expect(saveButton).not.toHaveClass(/button-disabled/, {
		timeout: 15000,
	});
	await saveButton.click();
	const anotherChildAlert = page.locator('ion-alert');
	await expect(anotherChildAlert).toBeVisible({ timeout: 10000 });
	await anotherChildAlert.locator('button.alert-button-role-cancel').click();
	await expect(anotherChildAlert).toBeHidden({ timeout: 10000 });
	await expect(
		page.getByText(`${child.firstName} ${child.lastName}`, { exact: true }),
	).toBeVisible({ timeout: 15000 });
};

export const editChildFirstNameViaUi = async (
	page: Page,
	currentName: string,
	newFirstName: string,
): Promise<void> => {
	const childRow = page
		.locator('app-children-card ion-item')
		.filter({ hasText: currentName })
		.first();
	await expect(childRow).toBeVisible({ timeout: 10000 });
	await childRow.click();
	const form = childForm(page);
	await expect(form.locator('ion-input[formControlName="firstName"] input')).toBeVisible({
		timeout: 15000,
	});
	await fillIonicInput(
		form.locator('ion-input[formControlName="firstName"]'),
		newFirstName,
	);
	await form.locator('ion-button[type="submit"]').click();
	await expect(
		page.getByText(`${newFirstName} ${currentName.split(' ').slice(1).join(' ')}`, {
			exact: true,
		}),
	).toBeVisible({ timeout: 15000 });
};

export const removeChildViaUi = async (
	page: Page,
	childName: string,
): Promise<void> => {
	const childRow = page
		.locator('app-children-card ion-item')
		.filter({ hasText: childName })
		.first();
	await expect(childRow).toBeVisible({ timeout: 10000 });
	await childRow.click();
	const form = childForm(page);
	await expect(form).toBeVisible({ timeout: 15000 });
	await form.locator('[data-delete-child]').click();
	const alert = page.locator('ion-alert');
	if (await alert.count()) {
		await expect(alert).toBeVisible({ timeout: 10000 });
		await alert.locator('button.alert-button-role-destructive').click();
	}
	await expect(childRow).toHaveCount(0, { timeout: 15000 });
};

/**
 * Selects a current-availability appointment in the progressive overview.
 * Older builds exposed data-select-slot-id; the consolidated card exposes
 * semantic buttons, so use the numeric suffix as the stable fallback index.
 */
export const selectAppointmentViaUi = async (
	page: Page,
	slotId: string,
): Promise<void> => {
	await page.goto('/pre-registration/overview#appointment');
	const schedule = page.locator('app-schedule-card');
	await expect(schedule).toBeVisible({ timeout: 15000 });

	const explicitSlot = schedule.locator(`[data-select-slot-id="${slotId}"]`);
	if (await explicitSlot.count()) {
		const dateAccordion = explicitSlot.locator('xpath=ancestor::ion-accordion');
		await dateAccordion.locator('ion-item[slot="header"]').click();
		await expect(explicitSlot).toBeVisible({ timeout: 15000 });
		await explicitSlot.click();
	} else {
		const changeButton = schedule.getByRole('button', {
			name: /change time|cambiar hora/i,
		});
		if (await changeButton.count()) await changeButton.click();

		const firstDateAccordion = schedule.locator('ion-accordion').first();
		await firstDateAccordion.locator('ion-item[slot="header"]').click();
		const slotItems = firstDateAccordion.locator('ion-list [data-select-slot-id]');
		await expect(slotItems.first()).toBeVisible({ timeout: 15000 });
		const suffix = /(?:^|[-_])(\d+)$/.exec(slotId)?.[1];
		const index = suffix ? Math.max(0, Number(suffix) - 1) : 0;
		await slotItems.nth(index).click();
	}

	await expect(schedule.locator('ion-badge')).toBeVisible({ timeout: 15000 });
	await page.reload();
	await expect(page.locator('app-schedule-card ion-badge')).toBeVisible({
		timeout: 15000,
	});
};

export const submitRegistrationViaUi = async (page: Page): Promise<void> => {
	await page.goto('/pre-registration/overview#review');
	const submitCard = page.locator('app-submit-card');
	await expect(submitCard).toBeVisible({ timeout: 15000 });
	const completionAction = page.locator('#reviewAndSubmitButton');
	const reviewButton = submitCard.getByRole('button', {
		name: /review registration|revisar registro/i,
	});
	if (await completionAction.isVisible()) {
		await completionAction.click();
	} else if (await reviewButton.count()) {
		await reviewButton.click();
	}

	const submitButton = page.locator('#completeRegistrationButton');
	await expect(submitButton).not.toHaveClass(/button-disabled/, {
		timeout: 15000,
	});
	await submitButton.click();
	await page.waitForURL('**/pre-registration/confirmation', {
		timeout: 45000,
	});
	await expect(page.locator('#registrationQrCode')).toBeVisible({
		timeout: 15000,
	});
};

const fillIonicInput = async (
	host: Locator,
	value: string,
): Promise<void> => {
	const input = host.locator('input').first();
	await expect(input).toBeVisible({ timeout: 15000 });
	await input.fill(value);
	await expect(input).toHaveValue(value, { timeout: 10000 });
	await input.blur();
	// The child name inputs intentionally debounce ionInput by 500 ms.
	await new Promise((resolve) => setTimeout(resolve, 550));
};

const setBirthDate = async (
	host: Locator,
	value: string,
): Promise<void> => {
	const input = host.locator('input').first();
	await expect(input).toBeVisible({ timeout: 15000 });
	await input.fill(value);
	await expect(input).toHaveValue(value, { timeout: 10000 });
	await host.evaluate((element, dateOfBirth) => {
		element.dispatchEvent(
			new CustomEvent('ionChange', {
				bubbles: true,
				detail: { value: dateOfBirth },
			}),
		);
	}, value);
	await input.blur();
};
