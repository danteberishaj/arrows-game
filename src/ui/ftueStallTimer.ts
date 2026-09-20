/** Pure deadline state for one tutorial-board stall hint. */
export class FtueStallTimer {
  private dueAt: number | null = null;

  constructor(private readonly delayMs: number | null) {}

  arm(now: number): void {
    this.dueAt = this.delayMs === null ? null : now + this.delayMs;
  }

  /** Returns whether an active deadline was moved. */
  onRemoval(now: number): boolean {
    if (this.delayMs === null || this.dueAt === null) return false;
    this.dueAt = now + this.delayMs;
    return true;
  }

  cancel(): void {
    this.dueAt = null;
  }

  due(now: number): boolean {
    if (this.dueAt === null || now < this.dueAt) return false;
    this.dueAt = null;
    return true;
  }
}
