import { BookingFlow } from "./BookingFlow";

export default function BookPage() {
  return (
    <div className="min-h-screen bg-bg p-4 flex justify-center">
      <div className="w-full max-w-lg py-10">
        <div className="mb-6 text-center">
          <p className="eyebrow mb-1">AN Logistics</p>
          <h1 className="h-page">Book a courier</h1>
          <p className="text-sm text-ink-2 mt-1">
            Check pincode coverage and rates, then book — through our own network or one of our onboarded delivery
            partners.
          </p>
        </div>
        <BookingFlow />
      </div>
    </div>
  );
}
