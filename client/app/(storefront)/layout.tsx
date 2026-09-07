import { BagDrawer } from "@/components/bag/BagDrawer";
import { BagProvider } from "@/components/bag/BagProvider";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { getEmptyRailImage, getInitialBag } from "@/lib/mock";

export default async function StorefrontLayout({
  children,
}: LayoutProps<"/">) {
  const [initialLines, emptyImage] = await Promise.all([
    getInitialBag(),
    getEmptyRailImage(),
  ]);

  return (
    <BagProvider initialLines={initialLines}>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-bottle focus:px-4 focus:py-3 focus:text-meta focus:text-stone"
      >
        Skip to content
      </a>
      <Header />
      <main id="content" className="flex-1">
        {children}
      </main>
      <Footer />
      <BagDrawer emptyImage={emptyImage} />
    </BagProvider>
  );
}
