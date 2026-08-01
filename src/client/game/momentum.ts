export class MomentumEngine {
    private home = 50;
    private away = 50;

    update(dt: number) {
        // Slowly return toward 50 every frame
        this.home += (50 - this.home) * dt * 0.15;
        this.away += (50 - this.away) * dt * 0.15;
    }

    goal(team: "home" | "away") {
        if (team === "home") {
            this.home = Math.min(100, this.home + 20);
            this.away = Math.max(0, this.away - 10);
        } else {
            this.away = Math.min(100, this.away + 20);
            this.home = Math.max(0, this.home - 10);
        }
    }

    get(team: "home" | "away") {
        return team === "home" ? this.home : this.away;
    }

    multiplier(team: "home" | "away") {
        return 1 + ((this.get(team) - 50) / 50) * 0.08;
    }
}