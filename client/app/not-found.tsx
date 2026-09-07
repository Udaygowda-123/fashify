import Link from "next/link";

/**
 * Self-contained rather than wrapped in the shop chrome: an unmatched URL can
 * be anything, so this page carries its own way out. Bottle green, because it
 * is the only full-page moment other than the hero.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-bottle text-stone">
      <header className="mx-auto flex w-full max-w-[1600px] items-center pad-x py-6 md:py-8">
        <Link href="/" className="font-display text-[1.375rem] leading-none">
          Fashify
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center pad-x py-16">
        <p className="text-meta text-mist-light" data-numeric>
          404
        </p>
        <h1 className="mt-4 max-w-[24ch] font-display text-d1">
          There is nothing at this address
        </h1>
        <p className="mt-6 max-w-[46ch] text-b1 text-mist-light">
          Either the piece has sold through and been retired, or the address has
          a typo in it. The collection is sixteen pieces, so it will not take
          long to find what you were after.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/shop"
            className="inline-flex min-h-11 items-center bg-stone px-6 text-meta text-bottle transition-colors duration-200 hover:bg-white motion-reduce:transition-none"
          >
            See everything
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center border border-mist-light/60 px-6 text-meta text-stone transition-colors duration-200 hover:border-stone motion-reduce:transition-none"
          >
            Back to the front
          </Link>
        </div>
      </div>
    </div>
  );
}
