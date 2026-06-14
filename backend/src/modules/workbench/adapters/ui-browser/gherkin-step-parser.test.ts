import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGherkinSteps, scenarioTitleFromGherkin } from './gherkin-step-parser.js';

const scenario = `
Feature: Home page
  Scenario: Hero section visible
    Given the user is on the home page
    When the page finishes loading
    And the user scrolls to the hero section
    Then the hero promotional content is visible
`;

test('parseGherkinSteps extracts steps with effective kinds', () => {
  const steps = parseGherkinSteps(scenario);
  assert.equal(steps.length, 4);
  assert.equal(steps[0]?.effectiveKind, 'Given');
  assert.equal(steps[1]?.effectiveKind, 'When');
  assert.equal(steps[2]?.effectiveKind, 'When');
  assert.equal(steps[3]?.effectiveKind, 'Then');
  assert.match(steps[3]?.text ?? '', /hero promotional/i);
});

test('scenarioTitleFromGherkin reads Scenario line', () => {
  assert.equal(scenarioTitleFromGherkin(scenario), 'Hero section visible');
});
