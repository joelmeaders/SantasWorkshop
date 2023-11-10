import { AgeGroup } from '../../../santashop-models/src';

export function getAgeFromDate(birthday: Date, fromDate: Date) {
	const today = fromDate;
	let thisYear = 0;

	const monthCheck = today.getMonth() < birthday.getMonth();
	const noTimeForThis =
		today.getMonth() == birthday.getMonth() &&
		today.getDate() < birthday.getDate();

	if (monthCheck || noTimeForThis) thisYear = 1;

	return today.getFullYear() - birthday.getFullYear() - thisYear;
}

export function getAgeGroupFromAge(ageInYears: number): AgeGroup {
	if (ageInYears >= 0 && ageInYears < 3) {
		return AgeGroup.age02;
	} else if (ageInYears >= 3 && ageInYears < 6) {
		return AgeGroup.age35;
	} else if (ageInYears >= 6 && ageInYears < 9) {
		return AgeGroup.age68;
	} else if (ageInYears >= 9 && ageInYears < 12) {
		return AgeGroup.age911;
	} else {
		throw new Error('invalid age');
	}
}
