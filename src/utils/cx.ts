type ClassValue = string | number | false | null | undefined | Record<string, boolean | undefined>;

/** Joins class names, skipping falsy values. Objects toggle keys by truthy value. */
export function cx(...args: ClassValue[]): string {
  const classes: string[] = [];

  for (const arg of args) {
    if (!arg) continue;

    if (typeof arg === "string" || typeof arg === "number") {
      classes.push(String(arg));
      continue;
    }

    for (const key in arg) {
      if (arg[key]) classes.push(key);
    }
  }

  return classes.join(" ");
}
