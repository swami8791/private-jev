export const DISCLAIMER = 'Model judgment on supplied content; not independent fact verification.';
export const MODEL = 'jev-1.14.0';
export class JevError extends Error {
  public readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export interface ScoreQuestion { type: 'score'; instructions: string; criteria: string[] }
export interface ChoiceQuestion { type: 'choice'; instructions: string; criteria: Record<string, string> }
export interface NoulQuestion { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
export type Question = ScoreQuestion | ChoiceQuestion | NoulQuestion;
export interface Source { title: string; url: string }
export interface EvaluationInput { state: string; questions: Record<string, Question>; sources?: Source[] }
export interface Usage { input_tokens: number; output_tokens: number }
interface AnswerBase { needs_review: boolean; criteria: Question['criteria'] }
export interface ScoreAnswer extends AnswerBase {
  type: 'score'; raw_score: number; normalized_score: number; score_100: number;
  confidence: number; probabilities: Record<string, number>; raw_range: [number, number];
}
export interface ChoiceAnswer extends AnswerBase {
  type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number>;
}
export interface NoulAnswer extends AnswerBase { type: 'noul'; yes_probability: number; confidence: null }
export type Answer = ScoreAnswer | ChoiceAnswer | NoulAnswer;
export interface ValidatedResponse { model: string; answers: Record<string, Answer>; usage: Usage }

export const bytes = (text: string): number => new TextEncoder().encode(text).byteLength;
function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new JevError(code);
}
export function object(value: unknown, code = 'INVALID_INPUT'): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code);
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, code);
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: string[], required: string[], code = 'INVALID_INPUT'): void {
  check(Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key)), code);
}
function text(value: unknown, max: number, code = 'INVALID_INPUT'): asserts value is string {
  check(typeof value === 'string' && value.trim().length > 0 && bytes(value) <= max, code);
}
const reserved = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
function identifier(value: string): void {
  check(/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(value) && !reserved.has(value), 'INVALID_INPUT');
}
export function parseInput(value: unknown): EvaluationInput {
  const data = object(value);
  keys(data, ['state', 'questions', 'sources'], ['state', 'questions']);
  text(data.state, 16384);
  const questions = object(data.questions);
  check(Object.keys(questions).length >= 1 && Object.keys(questions).length <= 8, 'INVALID_INPUT');
  let total = 0;
  for (const [name, raw] of Object.entries(questions)) {
    identifier(name);
    const question = object(raw);
    keys(question, ['type', 'instructions', 'criteria'], ['type', 'instructions']);
    text(question.instructions, 1024);
    total += bytes(question.instructions);
    let descriptions: unknown[];
    if (question.type === 'score') {
      check(Array.isArray(question.criteria) && question.criteria.length >= 2 && question.criteria.length <= 10, 'INVALID_INPUT');
      descriptions = question.criteria;
    } else if (question.type === 'choice') {
      const criteria = object(question.criteria);
      const labels = Object.keys(criteria);
      check(labels.length >= 2 && labels.length <= 10 && Object.hasOwn(criteria, 'uncertain'), 'INVALID_INPUT');
      labels.forEach(identifier);
      descriptions = Object.values(criteria);
    } else {
      check(question.type === 'noul', 'INVALID_INPUT');
      if (Object.hasOwn(question, 'criteria')) {
        const criteria = object(question.criteria);
        keys(criteria, ['true', 'false'], ['true', 'false']);
        descriptions = Object.values(criteria);
      } else descriptions = [];
    }
    for (const description of descriptions) { text(description, 512); total += bytes(description); }
  }
  check(total <= 8192, 'INVALID_INPUT');
  if (Object.hasOwn(data, 'sources')) {
    check(Array.isArray(data.sources) && data.sources.length <= 3, 'INVALID_INPUT');
    for (const raw of data.sources) {
      const source = object(raw); keys(source, ['title', 'url'], ['title', 'url']);
      text(source.title, 480); text(source.url, 8192);
      check([...source.title].length <= 120 && [...source.url].length <= 2048, 'INVALID_INPUT');
      try { check(new URL(source.url).protocol === 'https:', 'INVALID_INPUT'); }
      catch { throw new JevError('INVALID_INPUT'); }
    }
  }
  // The encoded arguments also have a cap, independent of the HTTP envelope cap.
  check(bytes(JSON.stringify(data)) <= 32768, 'INVALID_INPUT');
  return structuredClone(data) as unknown as EvaluationInput;
}
const BAD = 'MALFORMED_RESPONSE';
function number(value: unknown, min: number, max: number): asserts value is number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, BAD);
}
function distribution(value: unknown, labels: string[]): Record<string, number> {
  const probabilities = object(value, BAD); keys(probabilities, labels, labels, BAD);
  let sum = 0;
  for (const probability of Object.values(probabilities)) { number(probability, 0, 1); sum += probability; }
  check(Math.abs(sum - 1) <= .02 + Number.EPSILON, BAD);
  return probabilities as Record<string, number>;
}
export function validateAnswers(value: unknown, input: EvaluationInput): ValidatedResponse {
  const data = object(value, BAD); keys(data, ['model', 'answers', 'usage'], ['model', 'answers', 'usage'], BAD);
  text(data.model, 256, BAD);
  const usage = object(data.usage, BAD); keys(usage, ['input_tokens', 'output_tokens'], ['input_tokens', 'output_tokens'], BAD);
  for (const count of Object.values(usage)) { number(count, 0, Number.MAX_SAFE_INTEGER); check(Number.isSafeInteger(count), BAD); }
  const upstream = object(data.answers, BAD);
  const names = Object.keys(input.questions); keys(upstream, names, names, BAD);
  const answers: Record<string, Answer> = {};
  for (const [name, question] of Object.entries(input.questions)) {
    const answer = object(upstream[name], BAD); check(answer.type === question.type, BAD);
    const criteria = structuredClone(question.criteria);
    if (question.type === 'noul') {
      keys(answer, ['type', 'noul'], ['type', 'noul'], BAD); number(answer.noul, 0, 1);
      answers[name] = { type: 'noul', criteria, yes_probability: answer.noul, confidence: null, needs_review: answer.noul > .2 && answer.noul < .8 };
    } else if (question.type === 'score') {
      keys(answer, ['type', 'score', 'confidence', 'legend', 'probabilities'], ['type', 'score', 'confidence', 'legend', 'probabilities'], BAD);
      const top = question.criteria.length - 1;
      number(answer.score, 0, top); number(answer.confidence, 0, 1);
      const labels = question.criteria.map((_, index) => String(index));
      const probabilities = distribution(answer.probabilities, labels);
      const legend = object(answer.legend, BAD); keys(legend, labels, labels, BAD);
      labels.forEach((label, index) => check(legend[label] === question.criteria[index], BAD));
      answers[name] = { type: 'score', criteria, raw_score: answer.score, raw_range: [0, top], normalized_score: answer.score / top, score_100: 100 * (answer.score / top), confidence: answer.confidence, probabilities, needs_review: answer.confidence < .7 };
    } else {
      keys(answer, ['type', 'choice', 'confidence', 'probabilities'], ['type', 'choice', 'confidence', 'probabilities'], BAD);
      const labels = Object.keys(question.criteria);
      check(typeof answer.choice === 'string' && labels.includes(answer.choice), BAD);
      number(answer.confidence, 0, 1);
      answers[name] = { type: 'choice', criteria, choice: answer.choice, confidence: answer.confidence, probabilities: distribution(answer.probabilities, labels), needs_review: answer.confidence < .7 || answer.choice === 'uncertain' };
    }
  }
  return { model: data.model, usage: usage as unknown as Usage, answers };
}
