export const input = () => ({
  state: 'Synthetic: A fictional support ticket asks about a duplicate charge.',
  questions: {
    severity: { type: 'score', instructions: 'Rate impact.', criteria: ['Low', 'Medium', 'High'] },
    category: { type: 'choice', instructions: 'Choose category.', criteria: { billing: 'Payment issue', uncertain: 'Insufficient information' } },
    refund: { type: 'noul', instructions: 'Does it request a refund?', criteria: { true: 'Explicit request', false: 'No request' } },
  },
  sources: [{ title: 'Synthetic fixture', url: 'https://example.invalid/fixture' }],
});
export const provider = () => ({
  model: 'jev-1.14.0',
  answers: {
    severity: { type: 'score', score: 1.5, confidence: 0.69, legend: { '0': 'Low', '1': 'Medium', '2': 'High' }, probabilities: { '0': 0, '1': 0.5, '2': 0.5 } },
    category: { type: 'choice', choice: 'billing', confidence: 0.9, probabilities: { billing: 0.98, uncertain: 0.02 } },
    refund: { type: 'noul', noul: 0.5 },
  },
  usage: { input_tokens: 100, output_tokens: 20 },
});
