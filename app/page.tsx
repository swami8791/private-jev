import { DISCLAIMER, MODEL } from '../src/domain';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-8 py-20">
      <p className="text-sm text-stone-500">PRIVATE JEV</p>
      <h1 className="mt-4 text-3xl font-semibold">Judgment with uncertainty in view.</h1>
      <p className="mt-6 text-lg">{DISCLAIMER}</p>
      <section className="mt-10 rounded-xl border border-stone-200 p-6">
        <h2 className="font-semibold">Connection status</h2>
        <p className="mt-3">This local build has not been connected or tested against TypeSafe.</p>
        <p className="mt-3">Use jev_status through the private plugin after secure setup to check configuration. A configured key alone does not prove connectivity.</p>
      </section>
      <ul className="mt-8 space-y-3 text-stone-600">
        <li>Scores, classifications and yes/no probabilities from {MODEL}.</li>
        <li>Uncertain results are flagged for review. Thresholds are provisional.</li>
        <li>Supplied sources are unverified labels and are never fetched.</li>
        <li>No saved evaluations or automatic actions.</li>
      </ul>
      <p className="mt-8 text-sm text-stone-500">Secure key entry remains pending. Do not paste API keys into chat or this page.</p>
    </main>
  );
}
