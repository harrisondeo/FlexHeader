/**
 * Helpers for working with JSON rule fixtures.
 *
 * Use `compareWithFixture(actual, name, expectations)` in tests to assert that
 * the generated rules match the recorded fixture and contain expected headers.
 * Set `UPDATE_FIXTURES=true` in the environment to regenerate the fixture files
 * from the current output.
 */

import * as fs from "fs";
import * as path from "path";

const FIXTURES_DIR = path.join(__dirname, "rules");

export const shouldUpdateFixtures = (): boolean =>
  process.env.UPDATE_FIXTURES === "true";

const getFixturePath = (name: string): string =>
  path.join(FIXTURES_DIR, `${name}.json`);

export const loadFixture = (name: string): unknown => {
  const fixturePath = getFixturePath(name);
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }
  return JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
};

export const saveFixture = (name: string, data: unknown): void => {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  const fixturePath = getFixturePath(name);
  fs.writeFileSync(
    fixturePath,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf-8"
  );
};

export type HeaderExpectation = {
  headerName: string;
  operation?: "set" | "remove";
  priority?: number;
  conditionType?: "regexFilter" | "urlFilter";
  conditionValue?: string;
  shouldBePresent: boolean;
};

const ruleMatchesExpectation = (
  rule: any,
  expectation: HeaderExpectation
): boolean => {
  const headers =
    rule.action?.requestHeaders ?? rule.action?.responseHeaders ?? [];

  const headerMatch = headers.some(
    (h: any) =>
      h.header === expectation.headerName &&
      (expectation.operation === undefined || h.operation === expectation.operation)
  );
  if (!headerMatch) return false;

  if (expectation.priority !== undefined && rule.priority !== expectation.priority) {
    return false;
  }

  if (expectation.conditionType !== undefined) {
    const actualValue = rule.condition?.[expectation.conditionType];
    if (actualValue === undefined) return false;
    if (
      expectation.conditionValue !== undefined &&
      actualValue !== expectation.conditionValue
    ) {
      return false;
    }
  }

  return true;
};

const assertHeaderExpectations = (
  rules: any[],
  expectations: HeaderExpectation[]
): void => {
  for (const expectation of expectations) {
    const matchingRules = rules.filter((rule) =>
      ruleMatchesExpectation(rule, expectation)
    );
    const matchCount = matchingRules.length;

    if (expectation.shouldBePresent) {
      expect(matchCount).toBeGreaterThan(0);
    } else {
      expect(matchCount).toBe(0);
    }
  }
};

export const compareWithFixture = (
  actual: unknown,
  name: string,
  expectations: HeaderExpectation[] = []
): void => {
  const rules = actual as any[];

  if (shouldUpdateFixtures()) {
    saveFixture(name, actual);
  } else {
    const expected = loadFixture(name);
    expect(actual).toEqual(expected);
  }

  assertHeaderExpectations(rules, expectations);
};
