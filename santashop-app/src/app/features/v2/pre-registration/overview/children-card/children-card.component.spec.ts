import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
	provideTranslateServiceMock,
	provideActivatedRouteMock,
} from '../../../../../../test-helpers';
import { ChildrenCardComponent } from './children-card.component';

describe('ChildrenCardComponent', () => {
	let component: ChildrenCardComponent;
	let fixture: ComponentFixture<ChildrenCardComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ChildrenCardComponent],
			providers: [
				provideTranslateServiceMock(),
				provideActivatedRouteMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ChildrenCardComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('emits a valid new child without a route change', () => {
		const savedChild = jasmine.createSpy('savedChild');
		component.saveRequested.subscribe(savedChild);
		fixture.componentRef.setInput('programYear', 2025);
		component.openNewChild();
		component.form.setValue({
			id: 1,
			firstName: 'Taylor',
			lastName: 'Snow',
			dateOfBirth: '2020-01-02',
			ageGroup: '3-5' as never,
			toyType: 'girls' as never,
			programYearAdded: 2025,
			enabled: true,
		});

		component.saveChild();

		expect(savedChild).toHaveBeenCalled();
		expect(savedChild).toHaveBeenCalledWith(jasmine.objectContaining({
			isNew: true,
			child: jasmine.objectContaining({ firstName: 'Taylor' }),
		}));
		expect(component.editorOpen()).toBeTrue();
	});

	it('automatically selects the infant toy type without displaying toy controls', async () => {
		component.birthdaySelected('2025-01-02');
		await fixture.whenStable();

		expect(component.isInfant()).toBeTrue();
		expect(component.form.controls.toyType.value).toBe('infants' as never);
		expect(component.showToyTypeControls()).toBeFalse();
		expect(fixture.nativeElement.querySelector('ion-radio-group')).toBeNull();
	});

	it('displays toy controls after a non-infant birth date is selected', async () => {
		component.birthdaySelected('2020-01-02');
		await fixture.whenStable();

		expect(component.isInfant()).toBeFalse();
		expect(component.showToyTypeControls()).toBeTrue();
	});

	it('opens the edit modal when a child row is clicked', async () => {
		fixture.componentRef.setInput('children', [
			{
				id: 7,
				firstName: 'Taylor',
				lastName: 'Snow',
				dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
				ageGroup: '3-5' as never,
				toyType: 'girls' as never,
				programYearAdded: 2025,
				enabled: true,
			},
		]);
		fixture.componentRef.setInput('childCount', 1);
		component.collapseEditor();
		await fixture.whenStable();

		(fixture.nativeElement.querySelector('[data-child-id="7"]') as HTMLElement).click();
		await fixture.whenStable();

		expect(component.editorOpen()).toBeTrue();
		expect(component.editingChild()?.id).toBe(7);
		expect(component.form.controls.firstName.value).toBe('Taylor');
	});

	it('emits the current child when delete is requested from the edit modal', () => {
		const deletedChild = jasmine.createSpy('deletedChild');
		component.deleteRequested.subscribe(deletedChild);
		const child = {
			id: 7,
			firstName: 'Taylor',
			lastName: 'Snow',
			dateOfBirth: new Date('2020-01-02T00:00:00.000Z'),
			ageGroup: '3-5' as never,
			toyType: 'girls' as never,
			programYearAdded: 2025,
			enabled: true,
		};

		component.editChild(child);
		component.deleteCurrentChild();

		expect(deletedChild).toHaveBeenCalledWith(child);
	});

	it('opens a cleared add-child modal', () => {
		component.form.controls.firstName.setValue('Existing');
		component.openNewChild();

		expect(component.editorOpen()).toBeTrue();
		expect(component.editingChild()).toBeUndefined();
		expect(component.form.controls.firstName.value).toBe('');
	});
});
