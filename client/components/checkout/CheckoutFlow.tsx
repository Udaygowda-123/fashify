"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, SelectField } from "@/components/ui/Field";
import { StepIndicator, type Step } from "./StepIndicator";

const STEPS: Step[] = [
  { id: "contact", label: "Contact" },
  { id: "delivery", label: "Delivery" },
  { id: "payment", label: "Payment" },
];

const STATES = [
  { value: "", label: "Choose a state" },
  { value: "KA", label: "Karnataka" },
  { value: "MH", label: "Maharashtra" },
  { value: "DL", label: "Delhi" },
  { value: "TN", label: "Tamil Nadu" },
  { value: "WB", label: "West Bengal" },
  { value: "TG", label: "Telangana" },
  { value: "KL", label: "Kerala" },
];

/**
 * Three steps, no validation. The error and filled states below are rendered
 * from fixed props so both are real, styled markup you can look at — Phase 2
 * replaces them with the server's answer.
 */
export function CheckoutFlow() {
  const [step, setStep] = useState(0);

  return (
    <div>
      <StepIndicator
        steps={STEPS}
        current={step}
        onGoTo={(index) => setStep(index)}
      />

      <div className="mt-10">
        {step === 0 ? (
          <section aria-labelledby="step-contact">
            <h2 id="step-contact" className="font-display text-d3">
              Where should we send the receipt?
            </h2>
            <div className="mt-7 flex flex-col gap-6">
              <Field
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.in"
                defaultValue="ananya.rao@example.in"
                hint="We use this for the receipt and delivery updates, nothing else."
              />
              <Field
                label="Phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                inputMode="numeric"
                placeholder="98765 43210"
                hint="The courier calls this number before delivering."
              />
            </div>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button onClick={() => setStep(1)}>Continue to delivery</Button>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section aria-labelledby="step-delivery">
            <h2 id="step-delivery" className="font-display text-d3">
              Where is it going?
            </h2>
            <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                label="Full name"
                name="name"
                autoComplete="name"
                defaultValue="Ananya Rao"
                className="sm:col-span-2"
              />
              <Field
                label="Address"
                name="address1"
                autoComplete="address-line1"
                placeholder="Flat, house, building"
                className="sm:col-span-2"
              />
              <Field
                label="Area"
                name="address2"
                autoComplete="address-line2"
                placeholder="Street, locality"
                className="sm:col-span-2"
              />
              <Field label="City" name="city" autoComplete="address-level2" />
              <SelectField
                label="State"
                name="state"
                autoComplete="address-level1"
                options={STATES}
              />
              <Field
                label="PIN code"
                name="pin"
                autoComplete="postal-code"
                inputMode="numeric"
                defaultValue="5600"
                error="A PIN code is six digits. This one has four."
              />
            </div>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button onClick={() => setStep(2)}>Continue to payment</Button>
              <Button variant="quiet" onClick={() => setStep(0)}>
                Back to contact
              </Button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="step-payment">
            <h2 id="step-payment" className="font-display text-d3">
              How would you like to pay?
            </h2>
            <p className="mt-4 max-w-[46ch] text-b2 text-mist">
              Nothing is charged here. This is an interface, and no payment
              provider is connected to it yet.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                label="Card number"
                name="card"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                className="sm:col-span-2"
              />
              <Field
                label="Expiry"
                name="expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM / YY"
              />
              <Field
                label="Security code"
                name="cvc"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                hint="Three digits on the back of the card."
              />
              <Field
                label="Name on card"
                name="cardName"
                autoComplete="cc-name"
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button disabled>Pay and place order</Button>
              <Button variant="quiet" onClick={() => setStep(1)}>
                Back to delivery
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
