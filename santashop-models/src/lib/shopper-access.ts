export const SHOPPER_ACCESS_REASONS = [
	'duplicate-registration',
	'suspected-automated-signup',
	'registration-information-unverified',
] as const;

export type ShopperAccessReason = (typeof SHOPPER_ACCESS_REASONS)[number];

export interface ShopperAccessStatus {
	disabled: boolean;
	hasActiveRegistration: boolean;
}

export type SetShopperAccessRequest =
	| {
			uid: string;
			disabled: true;
			reason: ShopperAccessReason;
			evidenceId?: string;
	  }
	| { uid: string; disabled: false };

export interface ShopperAccessAudit {
	disabled: boolean;
	reason:
		ShopperAccessReason | 'both-parents-registered-same-children' | null;
	evidenceId: string | null;
	disposition: 'disabled' | 'reviewed-and-cleared';
	updatedBy: string;
	updatedAt: string;
}

export interface AdminShopperAccessStatus {
	disabled: boolean;
	audit: ShopperAccessAudit | null;
}
