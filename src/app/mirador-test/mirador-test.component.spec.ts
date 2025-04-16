import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MiradorTestComponent } from './mirador-test.component';

describe('MiradorTestComponent', () => {
  let component: MiradorTestComponent;
  let fixture: ComponentFixture<MiradorTestComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MiradorTestComponent]
    });
    fixture = TestBed.createComponent(MiradorTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
