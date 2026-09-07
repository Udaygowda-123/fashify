"use client";

import { useState } from "react";

/**
 * Nothing is sent anywhere — Phase 2 wires this up. It is a client component
 * only so the submit can be swallowed; a form that reloaded the page on submit
 * would be worse than no form at all.
 */
export function NewsletterField() {
  const [done, setDone] = useState(false);

  return (
    <form
      className="mt-8"
      onSubmit={(event) => {
        event.preventDefault();
        setDone(true);
      }}
    >
      <label htmlFor="footer-email" className="text-meta text-mist-light">
        New pieces, four or five times a year
      </label>
      <div className="mt-3 flex items-center gap-3 border-b border-mist-light/50 pb-2 focus-within:border-brass">
        <input
          id="footer-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.in"
          className="min-h-11 w-full bg-transparent text-b2 text-stone placeholder:text-mist-light focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 text-meta text-stone underline decoration-brass decoration-2 underline-offset-4"
        >
          Join
        </button>
      </div>
      <p className="mt-3 min-h-5 text-micro text-mist-light" aria-live="polite">
        {done ? "Added. The next letter goes out in October." : null}
      </p>
    </form>
  );
}
