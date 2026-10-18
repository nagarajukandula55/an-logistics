import Image from "next/image";
import Link from "next/link";
import { ApplicationForm } from "./ApplicationForm";

export default function SignupPage() {
  return <main className="mx-auto max-w-3xl p-6 py-12"><Link href="/" aria-label="AN Logistics home" className="inline-block rounded-xl bg-white px-3 py-1 shadow-sm"><Image src="/an-group-logistics.png" alt="AN Logistics" width={130} height={84} className="h-14 w-auto object-contain" /></Link><p className="eyebrow mt-10">Let’s work together</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Tell us about your shipping.</h1><p className="mb-8 mt-4 text-ink-2">We’ll contact you to discuss rates, courier options and an agreement. No password or payment is needed to apply.</p><ApplicationForm /></main>;
}
