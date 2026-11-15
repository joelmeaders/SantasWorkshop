import { AlertController } from '@ionic/angular/standalone';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import type {
	AdminShopperAccessStatus,
	ShopperAccessAudit,
} from '@santashop/models';
import { moduleMetadata, type Decorator } from '@storybook/angular-vite';

type Status = 'enabled' | ShopperAccessAudit['disposition'];

interface Change {
	disabled: boolean;
	reason?: ShopperAccessAudit['reason'];
}

export function shopperAccessStoryFixtures(initial: Status): Decorator {
	return moduleMetadata({
		providers: [
			{ provide: AlertController, useClass: AlertController },
			{
				provide: FunctionsWrapper,
				useFactory: (): object => {
					let status = initial;
					let reason: ShopperAccessAudit['reason'] =
						initial === 'enabled' ? null : 'duplicate-registration';
					const read = async (): Promise<{
						data: AdminShopperAccessStatus;
					}> => ({
						data: {
							disabled: status === 'disabled',
							audit:
								status === 'enabled'
									? null
									: {
											disabled: status === 'disabled',
											reason,
											disposition: status,
											evidenceId: null,
											updatedBy: 'demo-admin',
											updatedAt: '2026-11-15T16:00:00Z',
										},
						},
					});
					const update = async (
						change: Change,
					): Promise<{ data: Change }> => {
						status = change.disabled
							? 'disabled'
							: 'reviewed-and-cleared';
						if (change.reason) reason = change.reason;
						return { data: change };
					};
					return {
						callableWrapper: (
							name: string,
						): typeof read | typeof update =>
							name === 'callableGetShopperAccess' ? read : update,
					};
				},
			},
		],
	});
}
