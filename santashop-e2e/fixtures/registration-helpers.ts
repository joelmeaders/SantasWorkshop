import { expect, type Page } from '@playwright/test';

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

export const addChildViaUi = async (
	page: Page,
	child: TestChild,
): Promise<void> => {
	await page.goto('/pre-registration/children/add-child');
	await fillIonicInput(page, '#childFirstName', child.firstName);
	await fillIonicInput(page, '#childLastName', child.lastName);
	await setBirthDate(page, child.dateOfBirth);

	const toyType = page.locator(`#childToyType${capitalize(child.toyType)}`);
	await expect(toyType).toBeVisible({ timeout: 10000 });
	await toyType.click();

	const saveButton = page.locator('#saveChildButton');
	await expect(saveButton).not.toHaveClass(/button-disabled/, {
		timeout: 15000,
	});
	await saveButton.click();
	await page.waitForURL('**/pre-registration/children', {
		timeout: 30000,
	});
	await expect(
		page.getByText(`${child.firstName} ${child.lastName}`, { exact: true }),
	).toBeVisible({ timeout: 15000 });
};

export const editChildFirstNameViaUi = async (
	page: Page,
	currentName: string,
	newFirstName: string,
): Promise<void> => {
	const childRow = page.locator('[data-child-id]').filter({
		hasText: currentName,
	});
	await expect(childRow).toBeVisible({ timeout: 10000 });
	const childId = await childRow.getAttribute('data-child-id');
	expect(childId).toBeTruthy();

	await page.locator(`[data-edit-child-id="${childId}"]`).click();
	await expect(page.locator('#childFirstName input')).toBeVisible({
		timeout: 15000,
	});
	await fillIonicInput(page, '#childFirstName', newFirstName);
	await page.locator('#saveChildButton').click();
	await page.waitForURL('**/pre-registration/children', {
		timeout: 30000,
	});
};

export const removeChildViaUi = async (
	page: Page,
	childName: string,
): Promise<void> => {
	const childRow = page.locator('[data-child-id]').filter({
		hasText: childName,
	});
	await expect(childRow).toBeVisible({ timeout: 10000 });
	const childId = await childRow.getAttribute('data-child-id');
	expect(childId).toBeTruthy();

	await page.locator(`[data-remove-child-id="${childId}"]`).click();
	const alert = page.locator('ion-alert');
	await expect(alert).toBeVisible({ timeout: 10000 });
	await alert.locator('button.alert-button-role-destructive').click();
	await expect(childRow).toHaveCount(0, { timeout: 15000 });
};

export const selectAppointmentViaUi = async (
	page: Page,
	slotId: string,
): Promise<void> => {
	await page.goto('/pre-registration/date-time');
	const slotButton = page.locator(`[data-select-slot-id="${slotId}"]`);
	const accordion = slotButton.locator('xpath=ancestor::ion-accordion');
	await expect(accordion).toBeAttached({ timeout: 15000 });
	await accordion.locator('ion-item[slot="header"]').click();
	await expect(slotButton).toBeVisible({ timeout: 10000 });
	await slotButton.click();
	await expect(
		page.locator(`[data-selected-slot-id="${slotId}"]`),
	).toBeVisible({ timeout: 15000 });
	// The selected card renders from the mutated registration before the
	// Firestore write promise settles. Give the emulator write time to commit
	// before proving persistence on a different route.
	await page.waitForTimeout(1000);
	await page.goto('/pre-registration/overview');
	await expect(page.locator('#scheduleProgressCard')).toContainText(
		'Complete',
		{ timeout: 15000 },
	);
};

export const submitRegistrationViaUi = async (page: Page): Promise<void> => {
	await page.goto('/pre-registration/submit');
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
	page: Page,
	selector: string,
	value: string,
): Promise<void> => {
	const input = page.locator(`${selector} input`).first();
	await expect(input).toBeVisible({ timeout: 15000 });
	await input.fill(value);
	await expect(input).toHaveValue(value, { timeout: 10000 });
	await input.blur();
	// The child name inputs intentionally debounce ionInput by 500 ms.
	await page.waitForTimeout(550);
};

const setBirthDate = async (page: Page, value: string): Promise<void> => {
	const host = page.locator('#childDateOfBirth');
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

const capitalize = (value: string): string =>
	`${value.charAt(0).toUpperCase()}${value.slice(1)}`;
