# Rule fixtures

These JSON files contain the expected DNR rule output for various page/header/filter combinations. They are compared against the actual output of `buildHeaderRules` in [background.test.ts](../background.test.ts).

Each fixture test also asserts that specific headers are **present** or **absent** in the generated JSON, so that the expected/not-expected rule structure is validated even when fixtures are updated.

## Updating fixtures

If you intentionally change rule generation, regenerate the fixtures with:

```bash
bun run test:update-fixtures
```

This runs the fixture tests with `UPDATE_FIXTURES=true`, overwriting the JSON files with the current output. Review the resulting diffs before committing.

## Adding a new fixture

1. Add a new test case in `background.test.ts` under the `buildHeaderRules fixtures` describe block.
2. Call `compareWithFixture(actualRules, 'my-new-fixture', expectations)`.
3. Run `bun run test:update-fixtures` to generate `rules/my-new-fixture.json`.
4. Run `bun test -- --testPathPattern=background.test.ts --watchAll=false` to confirm the comparison passes.

### Header expectations

The optional third argument to `compareWithFixture` is an array of `HeaderExpectation` objects:

```ts
{
  headerName: string;          // required header name
  operation?: 'set' | 'remove';
  priority?: number;
  conditionType?: 'regexFilter' | 'urlFilter';
  conditionValue?: string;     // exact match when conditionType is provided
  shouldBePresent: boolean;    // true = must exist, false = must not exist
}
```

Use these to verify that expected headers appear with the right operation/priority/condition and that disabled/invalid/default rules do not leak into the output.
