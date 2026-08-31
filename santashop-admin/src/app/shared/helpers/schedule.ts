import { shopSchedule } from '@santashop/core';

export const getShopSchedule = (
	programYear: number,
	shopDays: readonly number[] = [],
): typeof shopSchedule => [
	...shopSchedule.filter((schedule) => schedule.year !== programYear),
	{
		year: programYear,
		days:
			shopDays.length > 0
				? [...shopDays]
				: (shopSchedule.find((schedule) => schedule.year === programYear)
						?.days ?? []),
	},
].filter((schedule) => schedule.days.length > 0);
