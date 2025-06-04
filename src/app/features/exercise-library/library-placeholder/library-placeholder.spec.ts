import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LibraryPlaceholder } from './library-placeholder';

describe('LibraryPlaceholder', () => {
  let component: LibraryPlaceholder;
  let fixture: ComponentFixture<LibraryPlaceholder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibraryPlaceholder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LibraryPlaceholder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
