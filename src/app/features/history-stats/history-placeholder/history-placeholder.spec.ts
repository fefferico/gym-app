import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoryPlaceholder } from './history-placeholder';

describe('HistoryPlaceholder', () => {
  let component: HistoryPlaceholder;
  let fixture: ComponentFixture<HistoryPlaceholder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryPlaceholder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoryPlaceholder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
