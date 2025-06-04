import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoutineList } from './routine-list';

describe('RoutineList', () => {
  let component: RoutineList;
  let fixture: ComponentFixture<RoutineList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutineList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoutineList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
