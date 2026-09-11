import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore/lite';
import { createReportCsv, reportDate, reportFilename } from './report-export';

describe('report exports', () => {
	it('quotes separators, embedded quotes and multiline values while retaining zero and unavailable cells', () => {
		expect(
			createReportCsv([
				['Referral', 'Users'],
				['School, "North"\nOffice', 0],
				[undefined, null],
			]),
		).toBe(
			'"Referral","Users"\r\n"School, ""North""\nOffice","0"\r\n"Unavailable","Unavailable"',
		);
	});

	it('prevents formula evaluation even after whitespace and control prefixes', () => {
		for (const value of [
			'=HYPERLINK("https://example.test")',
			'+SUM(1,2)',
			'-1+2',
			'@SUM(1,2)',
			' \t\r\n=1+1',
		]) {
			expect(createReportCsv([[value]])).toBe(
				`"'${value.replace(/"/g, '""')}"`,
			);
			expect(
				createReportCsv([
					[
						{
							label: value,
							description: 'Help shown below the label.',
						},
					],
				]),
			).toBe(`"'${value.replace(/"/g, '""')}"`);
		}
		expect(createReportCsv([[-2, '80219']])).toBe('"-2","80219"');
	});

	it('creates bounded safe download filenames', () => {
		expect(reportFilename('../../Registration ZIP codes 2026')).toBe(
			'registration-zip-codes-2026.csv',
		);
		expect(reportFilename('../')).toBe('report.csv');
		expect(reportFilename('a'.repeat(200))).toHaveLength(104);
	});

	it('accepts Firestore timestamps and dates without inventing missing dates', () => {
		const date = new Date('2026-09-10T12:30:00Z');
		expect(reportDate(Timestamp.fromDate(date))).toEqual(date);
		expect(reportDate(date)).toEqual(date);
		expect(reportDate(date.toISOString())).toEqual(date);
		expect(reportDate('2026-09-10T06:30:00-06:00')).toEqual(date);
		expect(reportDate(undefined)).toBeUndefined();
		expect(reportDate('')).toBeUndefined();
		expect(reportDate('0')).toBeUndefined();
		expect(reportDate(new Date('invalid'))).toBeUndefined();
		expect(reportDate({})).toBeUndefined();
		expect(
			reportDate({
				toDate: (): never => {
					throw new Error('invalid timestamp');
				},
			}),
		).toBeUndefined();
	});
});
