/**
 * Pure, dependency-free feature gates shared by main and renderer. Kept
 * side-effect free so they can be unit-tested without spinning up Electron
 * (see productionReadinessTest.ts).
 */

/** Developer Tools (test data generator, validation suite, prompt viewer) is
 *  for building/QA-ing OSEA Dive Manager itself — never for customers. */
export function shouldShowDeveloperTools(isPackaged: boolean): boolean {
  return !isPackaged
}
