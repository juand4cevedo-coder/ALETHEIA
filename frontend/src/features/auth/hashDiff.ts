/** Cuántos caracteres cambiaron entre dos huellas, posición por posición. */
export function changedCharacters(before: string, after: string): number {
  let changed = 0;
  for (let index = 0; index < after.length; index += 1) {
    if (before[index] !== after[index]) changed += 1;
  }
  return changed;
}
