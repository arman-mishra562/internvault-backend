// Utility to get points for a given difficulty
export function getPointsForDifficulty(difficulty: 'EASY' | 'NORMAL' | 'HARD'): number {
    switch (difficulty) {
        case 'EASY':
            return 10;
        case 'NORMAL':
            return 20;
        case 'HARD':
            return 30;
        default:
            return 0;
    }
}

// Utility to get target points for a given duration (in months)
export function getTargetPointsForDuration(duration: number): number {
    if (duration < 1) return 0;
    if (duration > 6) duration = 6;
    return duration * 10;
} 