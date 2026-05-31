export class Farewell {
  readonly version: string;
  readonly daytime: string;
  readonly farewell: string;
  readonly sleepTight: string;
  readonly sunsetHour: number;
  readonly cooldownHours: number;
  readonly sleepHour: number;
  readonly wakeHour: number;

  constructor(data: {
    version: string;
    daytime: string;
    farewell: string;
    sleepTight: string;
    sunsetHour: number;
    cooldownHours: number;
    sleepHour: number;
    wakeHour: number;
  }) {
    this.version = data.version;
    this.daytime = data.daytime;
    this.farewell = data.farewell;
    this.sleepTight = data.sleepTight;
    this.sunsetHour = data.sunsetHour;
    this.cooldownHours = data.cooldownHours;
    this.sleepHour = data.sleepHour;
    this.wakeHour = data.wakeHour;
  }

  getSunsetWindow(): string {
    const endHour = (this.sunsetHour + this.cooldownHours) % 24;
    return `${String(this.sunsetHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00`;
  }

  getSleepWindow(): string {
    return `${String(this.sleepHour).padStart(2, '0')}:00-${String(this.wakeHour).padStart(2, '0')}:00`;
  }

  private hourInWindow(currentHour: number, startHour: number, endHour: number): boolean {
    if (startHour === endHour) return true;
    if (startHour < endHour) return currentHour >= startHour && currentHour < endHour;
    return currentHour >= startHour || currentHour < endHour;
  }

  getMessage(currentHour: number): string {
    const sunsetEnd = (this.sunsetHour + this.cooldownHours) % 24;
    if (this.hourInWindow(currentHour, this.sleepHour, this.wakeHour)) {
      return this.sleepTight;
    }
    if (this.hourInWindow(currentHour, this.sunsetHour, sunsetEnd)) {
      return this.farewell;
    }
    return this.daytime;
  }
}
