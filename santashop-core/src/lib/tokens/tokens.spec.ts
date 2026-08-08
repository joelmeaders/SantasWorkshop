import { describe, expect, it } from 'vitest';
import { DEMO_MODE } from './demo.token';
import { MOBILE_EVENT } from './mobile-event.token';
import { PROFILE_VERSION } from './profile-version.token';
import { PROGRAM_YEAR } from './program-year.token';
import { SHOP_DAYS } from './shop-days.token';

describe('shared injection tokens', () => {
	it.each([
		[DEMO_MODE, 'demo-mode'],
		[MOBILE_EVENT, 'mobile-event'],
		[PROFILE_VERSION, 'profile-version'],
		[PROGRAM_YEAR, 'program-year'],
		[SHOP_DAYS, 'shop-days'],
	])('creates %s', (token, description) => {
		expect(token.toString()).toContain(description);
	});
});
