import { TestBed } from '@angular/core/testing';
import { FireRepoLite, IFireRepoCollection } from '@santashop/core';
import { COLLECTION_SCHEMA, DateTimeSlot } from '@santashop/models';
import { of, firstValueFrom } from 'rxjs';
import {
	createFireRepoLiteMock,
	provideProgramYearMock,
} from '../../../../../test-helpers';
import { ScheduleEditorService } from './schedule-editor.service';
import { OwnerOperationsService } from '../owner-operations/owner-operations.service';

describe('ScheduleEditorService', () => {
	let service: ScheduleEditorService;
	let fireRepo: jasmine.SpyObj<FireRepoLite>;
	let collection: jasmine.SpyObj<IFireRepoCollection<DateTimeSlot>>;
	let ownerOperations: jasmine.SpyObj<OwnerOperationsService>;

	beforeEach(() => {
		ownerOperations = jasmine.createSpyObj<OwnerOperationsService>(
			'OwnerOperationsService',
			['preview', 'start', 'get'],
		);
		TestBed.configureTestingModule({
			teardown: { destroyAfterEach: false },
			providers: [
				ScheduleEditorService,
				provideProgramYearMock(2025),
				{ provide: OwnerOperationsService, useValue: ownerOperations },
				{
					provide: FireRepoLite,
					useFactory: createFireRepoLiteMock,
				},
			],
		});

		service = TestBed.inject(ScheduleEditorService);
		fireRepo = TestBed.inject(FireRepoLite) as jasmine.SpyObj<FireRepoLite>;
		collection = fireRepo.collection(
			COLLECTION_SCHEMA.dateTimeSlots,
		) as jasmine.SpyObj<IFireRepoCollection<DateTimeSlot>>;
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('slots$ should convert timestamp-like values to dates and sort them', async () => {
		// Arrange
		const laterDate = new Date(2025, 11, 12, 11);
		const earlierDate = new Date(2025, 11, 12, 10);
		collection.readMany.and.returnValue(
			of([
				{
					id: 'later',
					programYear: 2025,
					dateTime: {
						toDate: (): Date => laterDate,
					} as unknown as Date,
					maxSlots: 20,
					enabled: true,
				},
				{
					id: 'earlier',
					programYear: 2025,
					dateTime: earlierDate,
					maxSlots: 20,
					enabled: true,
					slotsReserved: 2,
				},
			]),
		);

		// Act
		const result = await firstValueFrom(service.slots$);

		// Assert
		expect(result.map((slot) => slot.id)).toEqual(['earlier', 'later']);
		expect(result[0].dateTime instanceof Date).toBeTrue();
		expect(result[1].dateTime).toEqual(laterDate);
		expect(result[1].slotsReserved).toBe(0);
	});

	it('previewCreateSlots() should send normalized slots to the owner callable', async () => {
		// Arrange
		const existingDate = new Date(2025, 11, 12, 10);
		ownerOperations.preview.and.resolveTo({
			previewId: 'preview-1',
			operation: 'initialize-schedule',
			projectId: 'test-project',
			programYear: 2025,
			expiresAt: '2026-07-30T12:10:00.000Z',
			confirmationPhrase:
				'INITIALIZE SCHEDULE test-project 2025',
			counts: { requestedSlots: 1 },
			seasonRestricted: true,
		});

		// Act
		const result = await service.previewCreateSlots([
			{
				programYear: 2025,
				dateTime: existingDate,
				maxSlots: 30,
				enabled: true,
				slotsReserved: 0,
			},
		]);

		// Assert
		expect(result.previewId).toBe('preview-1');
		expect(ownerOperations.preview).toHaveBeenCalledOnceWith({
			operation: 'initialize-schedule',
			programYear: 2025,
			slots: [
				{
				programYear: 2025,
					dateTime: existingDate.toISOString(),
				maxSlots: 30,
				enabled: true,
				},
			],
		});
	});

	it('bulkUpdate() should update every selected slot', async () => {
		// Arrange
		const firstSlot: DateTimeSlot = {
			id: 'first',
			programYear: 2025,
			dateTime: new Date(2025, 11, 12, 10),
			maxSlots: 10,
			enabled: true,
		};
		const secondSlot: DateTimeSlot = {
			id: 'second',
			programYear: 2025,
			dateTime: new Date(2025, 11, 12, 11),
			maxSlots: 10,
			enabled: true,
		};

		// Act
		await service.bulkUpdate([firstSlot, secondSlot], {
			maxSlots: 25,
			enabled: false,
		});

		// Assert
		expect(collection.update).toHaveBeenCalledTimes(2);
		expect(collection.update).toHaveBeenCalledWith(
			'first',
			jasmine.objectContaining({
				programYear: 2025,
				maxSlots: 25,
				enabled: false,
				lastUpdated: jasmine.any(Date),
			}),
			true,
		);
		expect(collection.update).toHaveBeenCalledWith(
			'second',
			jasmine.objectContaining({
				programYear: 2025,
				maxSlots: 25,
				enabled: false,
				lastUpdated: jasmine.any(Date),
			}),
			true,
		);
	});

	it('bulkUpdate() should reject invalid capacities', async () => {
		// Arrange
		const slot: DateTimeSlot = {
			id: 'first',
			programYear: 2025,
			dateTime: new Date(2025, 11, 12, 10),
			maxSlots: 10,
			enabled: true,
		};

		// Act
		const action = service.bulkUpdate([slot], {
			maxSlots: -1,
		});

		// Assert
		await expectAsync(action).toBeRejectedWithError(
			TypeError,
			'Capacity must be a whole number zero or greater.',
		);
		expect(collection.update).not.toHaveBeenCalled();
	});

	it('bulkUpdate() should reject fractional capacities', async () => {
		// Arrange
		const slot: DateTimeSlot = {
			id: 'first',
			programYear: 2025,
			dateTime: new Date(2025, 11, 12, 10),
			maxSlots: 10,
			enabled: true,
		};

		// Act
		const action = service.bulkUpdate([slot], {
			maxSlots: 1.5,
		});

		// Assert
		await expectAsync(action).toBeRejectedWithError(
			TypeError,
			'Capacity must be a whole number zero or greater.',
		);
		expect(collection.update).not.toHaveBeenCalled();
	});

	it('updateSlot() should reject duplicate date/time values', async () => {
		// Arrange
		const duplicateDate = new Date(2025, 11, 12, 10);
		collection.readMany.and.returnValue(
			of([
				{
					id: 'first',
					programYear: 2025,
					dateTime: duplicateDate,
					maxSlots: 20,
					enabled: true,
				},
				{
					id: 'second',
					programYear: 2025,
					dateTime: duplicateDate,
					maxSlots: 20,
					enabled: true,
				},
			]),
		);

		// Act
		const action = service.updateSlot({
			id: 'first',
			programYear: 2025,
			dateTime: duplicateDate,
			maxSlots: 20,
			enabled: true,
		});

		// Assert
		await expectAsync(action).toBeRejectedWithError(
			'A schedule already exists for that date and time.',
		);
		expect(collection.update).not.toHaveBeenCalled();
	});

	it('deleteSlot() should delete the requested slot', async () => {
		// Arrange
		const slotId = 'slot-1';

		// Act
		await service.deleteSlot(slotId);

		// Assert
		expect(collection.delete).toHaveBeenCalledOnceWith(slotId);
	});
});
