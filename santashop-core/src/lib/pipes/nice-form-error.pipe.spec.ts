import { describe, expect, it } from 'vitest';
import { NiceFormErrorPipe } from './nice-form-error.pipe';

describe('NiceFormErrorPipe', () => {
	it('create an instance', () => {
		const pipe = new NiceFormErrorPipe();
		expect(pipe).toBeTruthy();
	});
});
