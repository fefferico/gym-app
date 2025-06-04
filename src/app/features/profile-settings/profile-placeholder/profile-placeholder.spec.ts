import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfilePlaceholder } from './profile-placeholder';

describe('ProfilePlaceholder', () => {
  let component: ProfilePlaceholder;
  let fixture: ComponentFixture<ProfilePlaceholder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePlaceholder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfilePlaceholder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
