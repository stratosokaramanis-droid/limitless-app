export const haptics = {
  tap: () => navigator.vibrate?.(8),
  success: () => navigator.vibrate?.([40, 30, 40]),
  heavy: () => navigator.vibrate?.(60),
}
