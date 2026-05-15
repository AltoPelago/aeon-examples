export class Greeting {
    public readonly version: string;
    public readonly daytime: string;
    public readonly nighttime: string;
    public readonly hoursBeforeMidnight: number;
    public readonly hoursAfterMidnight: number;

    constructor(data: any) {
        // At this boundary, we trust `data` possesses the exact shape enforced by AEON's strict validation
        this.version = data.version;
        this.daytime = data.daytime;
        this.nighttime = data.nighttime;
        this.hoursBeforeMidnight = data.hoursBeforeMidnight;
        this.hoursAfterMidnight = data.hoursAfterMidnight;
    }

    /**
     * Determines whether the current hour falls within the configured "night time" period.
     * @param currentHour The current hour of the day (0-23)
     */
    public getGreetingMessage(currentHour: number): string {
        // e.g. "4 hours before midnight" -> 20:00 (8 PM)
        const nightStartHour = 24 - this.hoursBeforeMidnight;

        // e.g. "5 hours after midnight" -> 05:00 (5 AM)
        const nightEndHour = this.hoursAfterMidnight;

        // A time falls inside the night hours if it is past nightStartHour OR early enough before nightEndHour
        const isNight = currentHour >= nightStartHour || currentHour < nightEndHour;

        return isNight ? `🌙 ${this.nighttime}` : `☀️ ${this.daytime}`;
    }

    public getNightHoursRange(): string {
        const nightStartHour = 24 - this.hoursBeforeMidnight;
        const nightEndHour = this.hoursAfterMidnight;
        return `${nightStartHour}:00 to 0${nightEndHour}:00`;
    }
}
