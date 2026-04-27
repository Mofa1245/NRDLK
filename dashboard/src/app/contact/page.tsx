import Link from 'next/link';

export default function ContactPage() {
  const salesWhatsapp = process.env.NEXT_PUBLIC_SALES_WHATSAPP_URL?.trim() || 'https://wa.me/';
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold text-stone-900">Contact sales</h1>
      <p className="mt-2 text-stone-600">
        Share your restaurant name and expected call volume. We will help you launch quickly.
      </p>

      <section className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-sm text-stone-700">Fastest channel: WhatsApp</p>
        <a
          href={salesWhatsapp}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded-lg bg-stone-900 px-4 py-2 text-white hover:bg-stone-700"
        >
          Chat on WhatsApp
        </a>
      </section>

      <div className="mt-6">
        <Link href="/signup" className="text-sm text-stone-600 hover:underline">
          Or create your account directly
        </Link>
      </div>
    </main>
  );
}
