export class Farewell {
  readonly version: string;
  readonly daytime: string;
  readonly farewell: string;
  readonly sunsetHour: number;
  readonly cooldownHours: number;

  constructor(data: {
    version: string;
    daytime: string;
    farewell: string;
    sunsetHour: number;
    cooldownHours: number;
  }) {
    this.version = data.version;
    this.daytime = data.daytime;
    this.farewell = data.farewell;
    this.sunsetHour = data.sunsetHour;
    this.cooldownHours = data.cooldownHours;
  }

  getSunsetWindow(): string {
    const endHour = (this.sunsetHour + this.cooldownHours) % 24;
    return `${String(this.sunsetHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00`;
  }

  getMessage(currentHour: number): string {
    const windowEnd = this.sunsetHour + this.cooldownHours;
    const isSunsetWindow = currentHour >= this.sunsetHour && currentHour < windowEnd;
    return isSunsetWindow ? this.farewell : this.daytime;
  }
}
