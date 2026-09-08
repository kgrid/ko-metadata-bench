import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { profileShapeDistance, profileShapeModel, profileShapeSignature, profileSocketModel } from "../app/profile-shape.js";

const inputProfile = {
  profile: "CompletedQuestionnaireResponseProfile",
  semanticType: "CompletedQuestionnaireResponse",
  required: ["specification_iri", "response_model_iri", "question_ids", "responses"],
  properties: {
    responses: { type: "array" },
    question_ids: { type: "array" },
    response_model_iri: { type: "string" },
    specification_iri: { type: "string" },
  },
};

const outputProfile = {
  profile: "WagnerAnalysisResultProfile",
  semanticType: "WagnerClassificationResult",
  required: ["analysis_status", "wagner_score", "grade_label"],
  properties: {
    analysis_status: { type: "string" },
    grade_label: { type: "array" },
    wagner_score: { type: "array" },
  },
};

test("profile shapes are deterministic and independent of property ordering", () => {
  const reordered = { ...inputProfile, required: [...inputProfile.required].reverse(), properties: Object.fromEntries(Object.entries(inputProfile.properties).reverse()) };
  assert.equal(profileShapeSignature(inputProfile), profileShapeSignature(reordered));
  assert.deepEqual(profileShapeModel(inputProfile), profileShapeModel(reordered));
});

test("different profile structures produce different stable contours", () => {
  const input = profileShapeModel(inputProfile);
  const output = profileShapeModel(outputProfile);
  assert.notEqual(input.hash, output.hash);
  assert.notEqual(input.path, output.path);
  assert.equal(input.marks.length, 4);
  assert.equal(output.marks.length, 3);
  assert.match(input.path, /^M \d+ \d+/);
  assert.match(output.path, /Z$/);
  assert.ok(profileShapeDistance(inputProfile, outputProfile) >= 12, "input and output profiles have clearly separated visual fingerprints");
  assert.notEqual(input.fingerprint[0], output.fingerprint[0], "the Wagner profiles occupy different broad silhouette families");
});

test("shape fingerprints respond to structural profile facts rather than property order", () => {
  const simple = { profile: "SimpleProfile", semanticType: "Simple", required: ["value"], properties: { value: { type: "string" } } };
  const structured = { profile: "StructuredProfile", semanticType: "Structured", required: ["value", "members"], properties: { value: { type: "string" }, members: { type: "array", items: { type: "integer" } } } };
  assert.ok(profileShapeDistance(simple, structured) >= 12);
  assert.notDeepEqual(profileShapeModel(simple).fingerprint, profileShapeModel(structured).fingerprint);
});

test("binding sockets reuse the exact canonical profile contour and a stable seat", () => {
  for (const profile of [inputProfile, outputProfile]) {
    const shape = profileShapeModel(profile);
    const socket = profileSocketModel(profile);
    assert.equal(socket.signature, shape.signature);
    assert.equal(socket.hash, shape.hash);
    assert.equal(socket.path, shape.path);
    assert.deepEqual(socket.seat, { x: 29, y: 15, scale: 0.68 });
    assert.equal(socket.transform, "translate(29 15) scale(0.68)");
  }
});

test("React and standalone editions both render deterministic profile shapes", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = await readFile(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(page, /function ProfileShape/);
  assert.match(page, /data-profile-shape/);
  assert.match(page, /<ProfileShape profile=\{inputObject\.profile\}/);
  assert.match(page, /<ProfileShape profile=\{outputObject\.profile\}/);
  assert.match(standalone, /function profileShapeModelStandalone/);
  assert.match(standalone, /function profileShapeFactsStandalone/);
  assert.match(standalone, /function profileSocketModelStandalone/);
  assert.match(standalone, /fingerprint=\[family/);
  assert.match(standalone, /data-profile-shape/);
  assert.match(standalone, /data-shape-input-profile/);
  assert.match(standalone, /data-shape-output-profile/);
});
