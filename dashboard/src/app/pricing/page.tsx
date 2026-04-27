import Link from 'next/link';

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-semibold text-stone-900">Simple pricing</h1>
      <p className="mt-2 text-stone-600">Start lean. Upgrade only when call volume grows.</p>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium">Basic</h2>
          <p className="mt-1 text-sm text-stone-600">Reliable capture + WhatsApp confirmation + dashboard queues.</p>
          <ul className="mt-3 list-disc pl-5 text-sm text-stone-700">
            <li>Fallback voice pipeline</li>
            <li>Booking confirmation flow</li>
            <li>Operations dashboard</li>
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium">Premium</h2>
          <p className="mt-1 text-sm text-stone-600">For higher volume and realtime interactions.</p>
          <ul className="mt-3 list-disc pl-5 text-sm text-stone-700">
            <li>Realtime voice option</li>
            <li>Priority support workflows</li>
            <li>Higher monthly limits</li>
          </ul>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700">
          Get Started
        </Link>
        <Link href="/contact" className="rounded-lg border border-stone-300 px-4 py-2 text-stone-700 hover:bg-stone-100">
          Talk to sales
        </Link>
      </div>
    </main>
  );
}
