// core/matching.ts
import path from 'path';

export function findMatches<T>({
  input,
  options,
  getName,
}: {
  input: string;
  options: T[];
  getName: (option: T) => string;
}): T[] {
  if (!input) return options;

  const lowerInput = input.toLowerCase();
  const inputChars = lowerInput.split('');

  return options.filter((opt) => {
    const name = getName(opt).toLowerCase();
    let nameIndex = 0;

    for (const char of inputChars) {
      nameIndex = name.indexOf(char, nameIndex);
      if (nameIndex === -1) return false;
      nameIndex++;
    }
    return true;
  });
}

export function canAddSelection<T>({
  selectedOptions,
  maxSelections,
}: {
  selectedOptions: T[];
  maxSelections: number | null;
}): boolean {
  return maxSelections === null || selectedOptions.length < maxSelections;
}

export function defaultDisplay<T>({
  option,
  input,
  getName,
}: {
  option: T;
  input: string;
  getName: (option: T) => string;
}): string {
  const name = getName(option);
  if (!input) return name;

  const lowerName = name.toLowerCase();
  const lowerInput = input.toLowerCase();
  const inputChars = lowerInput.split('');
  let nameIndex = 0;
  const matchIndices: number[] = [];

  for (const char of inputChars) {
    nameIndex = lowerName.indexOf(char, nameIndex);
    if (nameIndex === -1) return name;
    matchIndices.push(nameIndex);
    nameIndex++;
  }

  let result = '';
  let lastIndex = 0;
  matchIndices.forEach((index) => {
    result += name.slice(lastIndex, index);
    result += `\x1b[36m${name[index]}\x1b[0m`;
    lastIndex = index + 1;
  });
  result += name.slice(lastIndex);

  return result;
}

export function groupOptionsByDirectory<T>({
  options,
  getName,
  maxDisplay,
}: {
  options: T[];
  getName: (option: T) => string;
  maxDisplay: number;
}): T[] {
  // Group options by top-level directory
  const optionsByTopLevelDir: { [topLevelDir: string]: T[] } = {};
  options.forEach((opt) => {
    const name = getName(opt);
    const topLevelDir = name.includes(path.sep) ? name.split(path.sep)[0] : '.';
    if (!optionsByTopLevelDir[topLevelDir]) {
      optionsByTopLevelDir[topLevelDir] = [];
    }
    optionsByTopLevelDir[topLevelDir].push(opt);
  });

  const topLevelDirs = Object.keys(optionsByTopLevelDir).sort();
  let displayOptions: T[] = [];

  if (options.length <= maxDisplay) {
    // Display all options if they fit
    topLevelDirs.forEach((dir) => {
      optionsByTopLevelDir[dir].sort((a, b) =>
        getName(a).localeCompare(getName(b)),
      );
      displayOptions.push(...optionsByTopLevelDir[dir]);
    });
  } else {
    const n = topLevelDirs.length;
    if (n > 0) {
      // Calculate base slots per directory
      const baseSlots = Math.floor(maxDisplay / n);
      let remainingSlots = maxDisplay % n;
      const slotsByDir: { [dir: string]: number } = {};

      // Initial allocation based on file counts
      topLevelDirs.forEach((dir) => {
        const fileCount = optionsByTopLevelDir[dir].length;
        slotsByDir[dir] = Math.min(baseSlots, fileCount);
      });

      // Distribute remaining slots to directories with more files
      let totalAssigned = topLevelDirs.reduce(
        (sum, dir) => sum + slotsByDir[dir],
        0,
      );
      remainingSlots = maxDisplay - totalAssigned;
      let dirIndex = 0;
      while (remainingSlots > 0 && dirIndex < topLevelDirs.length) {
        const dir = topLevelDirs[dirIndex];
        if (optionsByTopLevelDir[dir].length > slotsByDir[dir]) {
          slotsByDir[dir]++;
          remainingSlots--;
        }
        dirIndex = (dirIndex + 1) % topLevelDirs.length;
      }

      // Build display options with sorted files
      displayOptions = [];
      topLevelDirs.forEach((dir) => {
        const dirOptions = optionsByTopLevelDir[dir]
          .sort((a, b) => getName(a).localeCompare(getName(b)))
          .slice(0, slotsByDir[dir]);
        displayOptions.push(...dirOptions);
      });

      // Fill any remaining space up to maxDisplay
      let currentCount = displayOptions.length;
      if (currentCount < maxDisplay) {
        let slotsToFill = maxDisplay - currentCount;
        dirIndex = 0;
        while (slotsToFill > 0 && dirIndex < topLevelDirs.length) {
          const dir = topLevelDirs[dirIndex];
          const remainingFiles =
            optionsByTopLevelDir[dir].length - slotsByDir[dir];
          if (remainingFiles > 0) {
            const toAdd = Math.min(remainingFiles, slotsToFill);
            const extraOptions = optionsByTopLevelDir[dir]
              .sort((a, b) => getName(a).localeCompare(getName(b)))
              .slice(slotsByDir[dir], slotsByDir[dir] + toAdd);
            displayOptions.push(...extraOptions);
            slotsByDir[dir] += toAdd;
            slotsToFill -= toAdd;
          }
          dirIndex++;
        }
      }

      displayOptions = displayOptions.slice(0, maxDisplay);
    }
  }

  return displayOptions;
}
