import Link from 'next/link';

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <header className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">Pricing</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900 md:text-4xl">Clear plans for modern restaurant operations</h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600 md:text-base">
          Start lean, scale with confidence, and keep service quality high across every guest call.
        </p>
      </header>

      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Basic</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-900">Strong foundation for daily operations</h2>
          <p className="mt-2 text-sm text-stone-600">Reliable call capture, confirmation flow, and dashboard visibility.</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-stone-700">
            <li>Fallback voice pipeline</li>
            <li>Booking confirmation flow</li>
            <li>Operations dashboard</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-stone-900 bg-stone-900 p-6 shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-300">Premium</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Premium experience for high-volume teams</h2>
          <p className="mt-2 text-sm text-stone-300">Realtime handling, faster workflows, and expanded operating limits.</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-stone-200">
            <li>Realtime voice option</li>
            <li>Priority support workflows</li>
            <li>Higher monthly limits</li>
          </ul>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700">
          Get Started
        </Link>
        <Link href="/contact" className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Talk to sales
        </Link>
      </div>
    </main>
  );
}
