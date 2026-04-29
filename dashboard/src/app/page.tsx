import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <header className="mb-8 flex items-center justify-between rounded-2xl border border-stone-200/80 bg-white/85 px-5 py-4 shadow-sm backdrop-blur">
        <p className="text-sm font-semibold tracking-wide text-stone-700">Qatar AI Phone</p>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/pricing" className="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900">Pricing</Link>
          <Link href="/contact" className="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900">Contact</Link>
          <Link href="/login" className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50">Sign in</Link>
        </nav>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-8 text-stone-100 shadow-2xl md:p-12">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-blue-300/20 blur-3xl" />
        <p className="relative text-xs font-medium uppercase tracking-[0.2em] text-stone-300">AI Front Desk for Restaurants</p>
        <h1 className="relative mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">
          A polished guest experience, even before your host answers.
        </h1>
        <p className="relative mt-4 max-w-2xl text-sm text-stone-300 md:text-base">
          Qatar AI Phone handles calls in Arabic and English, confirms details on WhatsApp, and gives your team an
          elegant command center for daily operations.
        </p>
        <div className="relative mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className="rounded-lg bg-white px-5 py-2.5 text-center text-sm font-medium text-stone-900 hover:bg-stone-200">
            Launch Your Business Account
          </Link>
          <Link href="/pricing" className="rounded-lg border border-stone-500 px-5 py-2.5 text-center text-sm font-medium text-stone-100 hover:border-stone-300 hover:bg-stone-700/40">
            Explore Plans
          </Link>
          <Link href="/contact" className="rounded-lg border border-stone-500 px-5 py-2.5 text-center text-sm font-medium text-stone-100 hover:border-stone-300 hover:bg-stone-700/40">
            Book a Demo
          </Link>
        </div>
        <div className="relative mt-8 grid gap-3 text-xs text-stone-300 sm:grid-cols-3">
          <p className="rounded-md border border-stone-600/70 bg-stone-900/60 px-3 py-2">Realtime bilingual voice</p>
          <p className="rounded-md border border-stone-600/70 bg-stone-900/60 px-3 py-2">WhatsApp guest confirmation</p>
          <p className="rounded-md border border-stone-600/70 bg-stone-900/60 px-3 py-2">Operations-ready dashboard</p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-stone-500">01</p>
          <h2 className="mt-1 text-base font-semibold text-stone-900">Calls are handled immediately</h2>
          <p className="mt-2 text-sm text-stone-600">No dead lines, no missed tables, no lost reservations during rush.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-stone-500">02</p>
          <h2 className="mt-1 text-base font-semibold text-stone-900">Guests confirm details on WhatsApp</h2>
          <p className="mt-2 text-sm text-stone-600">Date, time, and party size are validated before your team acts.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-stone-500">03</p>
          <h2 className="mt-1 text-base font-semibold text-stone-900">Your team runs service from one view</h2>
          <p className="mt-2 text-sm text-stone-600">Priority queues, booking status, and operational visibility in real time.</p>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Built for premium hospitality</p>
            <h3 className="mt-1 text-xl font-semibold text-stone-900">Designed to feel like part of your brand, not a bot.</h3>
          </div>
          <Link href="/signup" className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
            Create Account
          </Link>
        </div>
      </section>
    </main>
  );
}
