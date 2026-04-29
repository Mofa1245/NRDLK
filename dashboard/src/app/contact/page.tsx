import Link from 'next/link';

export default function ContactPage() {
  const salesWhatsapp = process.env.NEXT_PUBLIC_SALES_WHATSAPP_URL?.trim() || 'https://wa.me/';
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <section className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">Contact</p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-900">Speak with our onboarding team</h1>
        <p className="mt-3 text-sm text-stone-600 md:text-base">
          Share your restaurant profile and expected call volume. We will configure your setup with premium service standards.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-stone-800">Fastest channel: WhatsApp</p>
        <p className="mt-1 text-sm text-stone-600">Typical response time: within one business hour.</p>
        <a
          href={salesWhatsapp}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700"
        >
          Chat on WhatsApp
        </a>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-stone-500">Step 1</p>
          <p className="mt-1 text-sm font-medium text-stone-800">Share your business profile</p>
          <p className="mt-1 text-sm text-stone-600">Cuisine, peak hours, average booking volume, and language needs.</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-stone-500">Step 2</p>
          <p className="mt-1 text-sm font-medium text-stone-800">We configure your setup</p>
          <p className="mt-1 text-sm text-stone-600">Assistant behavior, confirmation flow, and dashboard preferences.</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-stone-500">Step 3</p>
          <p className="mt-1 text-sm font-medium text-stone-800">Go live with confidence</p>
          <p className="mt-1 text-sm text-stone-600">Monitor reservations and keep service standards high from day one.</p>
        </div>
      </section>

      <div className="mt-6">
        <Link href="/signup" className="text-sm font-medium text-stone-700 hover:underline">
          Or create your account directly
        </Link>
      </div>
    </main>
  );
}
