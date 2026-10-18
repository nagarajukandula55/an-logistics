import Link from "next/link";
import { ApplicationForm } from "./ApplicationForm";
export default function SignupPage() { return <main className="mx-auto max-w-3xl p-6 py-12"><Link href="/" className="text-accent">← AN Logistics</Link><p className="eyebrow mt-10">Let’s work together</p><h1 className="text-4xl font-semibold tracking-tight mt-2">Tell us about your shipping.</h1><p className="text-ink-2 mt-4 mb-8">We’ll contact you to discuss rates, courier options and an agreement. No password or payment is needed to apply.</p><ApplicationForm /></main>; }
