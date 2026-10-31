import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, validateAnswers } from '../src/domain.ts';
import { input, provider } from './fixtures.mjs';

test('accepts the three documented question shapes without changing supplied text', () => {
  assert.deepEqual(parseInput(input()), input());
});
const invalidInputs = {
  'empty state': x => { x.state = ' '; },
  'state UTF8 overflow': x => { x.state = 'é'.repeat(8193); },
  'no questions': x => { x.questions = {}; },
  'nine questions': x => { x.questions = Object.fromEntries(Array.from({length:9}, (_, i) => ['q'+i, x.questions.refund])); },
  'reserved ID': x => { x.questions.constructor = x.questions.refund; },
  'malformed ID': x => { x.questions['9bad'] = x.questions.refund; },
  'unknown top field': x => { x.url = 'https://evil.invalid'; },
  'unknown question field': x => { x.questions.refund.model = 'other'; },
  'unknown question type': x => { x.questions.refund.type = 'box'; },
  'instruction overflow': x => { x.questions.refund.instructions = 'a'.repeat(1025); },
  'empty criterion': x => { x.questions.severity.criteria[0] = ''; },
  'criterion overflow': x => { x.questions.severity.criteria[0] = 'é'.repeat(257); },
  'score only one level': x => { x.questions.severity.criteria = ['one']; },
  'score eleven levels': x => { x.questions.severity.criteria = Array(11).fill('one'); },
  'choice lacks uncertain': x => { x.questions.category.criteria = {yes:'yes',no:'no'}; },
  'reserved choice label': x => { x.questions.category.criteria.toString = 'bad'; },
  'noul wrong criteria': x => { x.questions.refund.criteria = { yes: 'yes' }; },
  'nonfinite criterion': x => { x.questions.refund.criteria.true = Infinity; },
  'too many sources': x => { x.sources = Array(4).fill(x.sources[0]); },
  'HTTP source': x => { x.sources[0].url = 'http://example.com'; },
  'long source title': x => { x.sources[0].title = 'x'.repeat(121); },
  'long source URL': x => { x.sources[0].url = 'https://example.com/'+'x'.repeat(2048); },
  'unknown source property': x => { x.sources[0].verified = true; },
  'aggregate criteria overflow': x => { x.questions = Object.fromEntries(Array.from({length:8}, (_,i)=>['q'+i,{type:'score',instructions:'x'.repeat(1024),criteria:['a','b']} ])); },
};
for (const [name, mutate] of Object.entries(invalidInputs)) test(`rejects ${name}`, () => {
  const value = input(); mutate(value); assert.throws(() => parseInput(value), /INVALID_INPUT/);
});
test('allows exact UTF8 state and question boundaries', () => {
  const value = input(); value.state = 'é'.repeat(8192); value.questions.refund.instructions = 'a'.repeat(1024);
  assert.equal(parseInput(value).state.length, 8192);
});
test('normalizes fractional scores and preserves independent confidence semantics', () => {
  const result = validateAnswers(provider(), input());
  assert.equal(result.answers.severity.raw_score, 1.5);
  assert.equal(result.answers.severity.normalized_score, 0.75);
  assert.equal(result.answers.severity.score_100, 75);
  assert.deepEqual(result.answers.severity.criteria, ['Low','Medium','High']);
  assert.equal(result.answers.severity.needs_review, true);
  assert.equal(result.answers.category.needs_review, false);
  assert.equal(result.answers.refund.yes_probability, 0.5);
  assert.equal(result.answers.refund.confidence, null);
  assert.equal(result.answers.refund.needs_review, true);
});
for (const [probability, review] of [[0,false],[.2,false],[.2001,true],[.7999,true],[.8,false],[1,false]]) test(`noul review boundary ${probability}`, () => {
  const value=provider();value.answers.refund.noul=probability;
  assert.equal(validateAnswers(value,input()).answers.refund.needs_review,review);
});
test('uncertain choice always needs review and .70 confidence is accepted', () => {
  const value=provider();value.answers.category.choice='uncertain';value.answers.category.probabilities={billing:0,uncertain:1};value.answers.category.confidence=1;value.answers.severity.confidence=.7;
  const result=validateAnswers(value,input());assert.equal(result.answers.category.needs_review,true);assert.equal(result.answers.severity.needs_review,false);
});
const invalidOutputs = {
  'missing answer': x => { delete x.answers.refund; },
  'extra answer': x => { x.answers.other={type:'noul',noul:.5}; },
  'wrong type': x => { x.answers.refund.type='score'; },
  'NaN': x => { x.answers.refund.noul=NaN; },
  'out of range score': x => { x.answers.severity.score=3; },
  'out of range confidence': x => { x.answers.category.confidence=1.01; },
  'unknown choice': x => { x.answers.category.choice='else'; },
  'missing probability': x => { delete x.answers.severity.probabilities['0']; },
  'bad level': x => { x.answers.severity.probabilities['3']=0; },
  'probability total': x => { x.answers.category.probabilities.billing=.5; },
  'negative probability': x => { x.answers.category.probabilities.uncertain=-.1; },
  'missing legend': x => { delete x.answers.severity.legend; },
  'wrong legend': x => { x.answers.severity.legend['0']='Different'; },
  'noninteger usage': x => { x.usage.input_tokens=.5; },
  'negative usage': x => { x.usage.output_tokens=-1; },
  'missing model': x => { delete x.model; },
};
for (const [name, mutate] of Object.entries(invalidOutputs)) test(`rejects upstream ${name}`, () => {
  const value=provider();mutate(value);assert.throws(()=>validateAnswers(value,input()),/MALFORMED_RESPONSE/);
});
test('accepts rounding tolerance without renormalizing probabilities', () => {
 const value=provider();value.answers.category.probabilities={billing:.97,uncertain:.02};
 assert.equal(validateAnswers(value,input()).answers.category.probabilities.billing,.97);
});
