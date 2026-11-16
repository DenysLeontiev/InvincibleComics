import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ReadingProgressService } from './reading-progress.service';

describe('ReadingProgressService', () => {
  let service: ReadingProgressService;

  beforeEach(() => {
    localStorage.removeItem('icr:progress.v1');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(ReadingProgressService);
  });

  afterEach(() => localStorage.removeItem('icr:progress.v1'));

  it('remembers the page and the last issue', () => {
    service.record('invincible-001', 5, 24);
    expect(service.get('invincible-001')?.page).toBe(5);
    expect(service.lastIssueId()).toBe('invincible-001');
    expect(service.resumePage('invincible-001', 24)).toBe(5);
    expect(service.fraction('invincible-001')).toBeCloseTo(5 / 24);
  });

  it('marks an issue finished on its last page and restarts it next time', () => {
    service.record('invincible-001', 24, 24);
    expect(service.get('invincible-001')?.completed).toBeTrue();
    expect(service.resumePage('invincible-001', 24)).toBe(1);
    expect(service.completedCount()).toBe(1);
  });

  it('stays finished when re-read from the start', () => {
    service.record('invincible-001', 24, 24);
    service.record('invincible-001', 2, 24);
    expect(service.get('invincible-001')?.completed).toBeTrue();
    expect(service.resumePage('invincible-001', 24)).toBe(2);
  });

  it('can mark issues read and unread', () => {
    service.setCompleted('invincible-002', 20, true);
    expect(service.fraction('invincible-002')).toBe(1);
    service.setCompleted('invincible-002', 20, false);
    expect(service.get('invincible-002')).toBeNull();
  });

  it('persists to localStorage', () => {
    service.record('invincible-003', 7, 22);
    TestBed.tick();
    const saved = JSON.parse(localStorage.getItem('icr:progress.v1') ?? '{}');
    expect(saved.issues['invincible-003'].page).toBe(7);
  });
});
