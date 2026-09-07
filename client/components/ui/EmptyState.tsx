import Image from "next/image";
import { cx } from "@/lib/format";
import type { ImageAsset } from "@/lib/mock/types";

interface EmptyStateProps {
  title: string;
  /** Say what to do next, not that something is missing. */
  body: string;
  image?: ImageAsset;
  actions?: React.ReactNode;
  /** The admin runs at a different type scale and on a white ground. */
  tone?: "shop" | "tool";
  className?: string;
}

export function EmptyState({
  title,
  body,
  image,
  actions,
  tone = "shop",
  className,
}: EmptyStateProps) {
  if (tone === "tool") {
    return (
      <div
        className={cx(
          "border border-tool-rule px-4 py-12 text-center",
          className,
        )}
      >
        <p className="text-[0.875rem]">{title}</p>
        <p className="mx-auto mt-2 max-w-[46ch] text-[0.8125rem] text-tool-mist">
          {body}
        </p>
        {actions ? (
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col", className)}>
      {image ? (
        <div className="max-w-md bg-stone-deep">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 48rem) 28rem, 100vw"
            className="h-auto w-full"
          />
        </div>
      ) : null}
      <h3 className={cx("font-display text-d3", image && "mt-6")}>{title}</h3>
      <p className="mt-3 max-w-[46ch] text-b2 text-mist">{body}</p>
      {actions ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">{actions}</div>
      ) : null}
    </div>
  );
}
