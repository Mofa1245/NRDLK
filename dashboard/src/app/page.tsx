import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-stone-500">Qatar AI Phone</p>
        <h1 className="mt-2 text-4xl font-semibold text-stone-900">Never miss a booking call again.</h1>
        <p className="mt-3 max-w-2xl text-stone-600">
          AI receptionist for restaurants with bilingual voice handling and WhatsApp confirmation. Calls are captured,
          corrected, and delivered into an operations-ready dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          <Link href="/signup" className="rounded-lg bg-stone-900 px-5 py-2 text-center text-white hover:bg-stone-700">
            Get Started
          </Link>
          <Link href="/pricing" className="rounded-lg border border-stone-300 px-5 py-2 text-center text-stone-700 hover:bg-stone-100">
            View Pricing
          </Link>
          <Link href="/contact" className="rounded-lg border border-stone-300 px-5 py-2 text-center text-stone-700 hover:bg-stone-100">
            Contact Sales
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-base font-medium">1) AI Answers Calls</h2>
          <p className="mt-1 text-sm text-stone-600">English + Arabic handling with fallback safety.</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-base font-medium">2) WhatsApp Confirms</h2>
          <p className="mt-1 text-sm text-stone-600">Customer edits time/people/date before final lock.</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-base font-medium">3) Dashboard Operates</h2>
          <p className="mt-1 text-sm text-stone-600">Queues, urgent handoff, and staff updates in one place.</p>
        </div>
      </section>
    </main>
  );
}
