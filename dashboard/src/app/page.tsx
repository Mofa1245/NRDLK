import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <header className="mb-8 flex items-center justify-between rounded-2xl border border-stone-200/80 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
        <p className="text-sm font-semibold tracking-wide text-stone-700">Qatar AI Phone</p>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/pricing" className="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900">Pricing</Link>
          <Link href="/contact" className="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900">Contact</Link>
          <Link href="/login" className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50">Sign in</Link>
        </nav>
      </header>

      <section className="rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-950 to-stone-800 p-8 text-stone-100 shadow-xl md:p-12">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-300">AI Front Desk for Restaurants</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
          High-class guest communication, from first call to confirmed booking.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-stone-300 md:text-base">
          Bilingual voice handling, WhatsApp confirmation, and a clean operations dashboard built for premium service
          standards.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="rounded-lg bg-white px-5 py-2.5 text-center text-sm font-medium text-stone-900 hover:bg-stone-200">
            Start Free Setup
          </Link>
          <Link href="/pricing" className="rounded-lg border border-stone-500 px-5 py-2.5 text-center text-sm font-medium text-stone-100 hover:border-stone-300 hover:bg-stone-700/40">
            View Plans
          </Link>
          <Link href="/contact" className="rounded-lg border border-stone-500 px-5 py-2.5 text-center text-sm font-medium text-stone-100 hover:border-stone-300 hover:bg-stone-700/40">
            Talk to Sales
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900">01 — Calls Answered Instantly</h2>
          <p className="mt-2 text-sm text-stone-600">Arabic + English voice handling with resilient fallback flow.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900">02 — Confirmed by WhatsApp</h2>
          <p className="mt-2 text-sm text-stone-600">Guests can confirm or correct details before operations lock in.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-900">03 — Managed in One Dashboard</h2>
          <p className="mt-2 text-sm text-stone-600">See queues, urgent handoff items, and team actions in real time.</p>
        </div>
      </section>
    </main>
  );
}
