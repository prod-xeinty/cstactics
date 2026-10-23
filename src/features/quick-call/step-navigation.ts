export function getNextStep(
    currentIndex: number,
    totalSteps: number,
): number {
    const maxStep = totalSteps - 1;
    return Math.min(currentIndex + 1, maxStep);
}

export function getPrevStep(currentIndex: number): number {
    return Math.max(currentIndex - 1, 0);
}