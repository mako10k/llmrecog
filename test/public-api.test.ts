import assert from "node:assert/strict";
import test from "node:test";

import * as api from "../src/index.js";

test("the initialized public entrypoint exposes only the semantic version", () => {
  assert.deepEqual(Object.keys(api), ["semanticVersion"]);
  assert.equal(api.semanticVersion, "0.1");
});
