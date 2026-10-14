import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiPage } from "@/components/ApiPage";
import { getMDXComponents } from "@/components/MdxComponents";
import { source } from "@/lib/source";

type Props = PageProps<"/docs/[[...slug]]">;

// The params are read inside <Suspense>: the shell is shared by every docs URL, so navigating
// between pages stays instant while the page's content streams in.
export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<DocsPageSkeleton />}>
      <DocsContent params={params} />
    </Suspense>
  );
}

async function DocsContent({ params }: Pick<Props, "params">) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();

  if (page.data.type === "openapi") {
    return (
      <DocsPage toc={page.data.toc} full>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody className="osg-openapi">
          <ApiPage {...page.data.getOpenAPIPageProps()} />
        </DocsBody>
      </DocsPage>
    );
  }

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  );
}

function DocsPageSkeleton() {
  return (
    <DocsPage toc={[]}>
      <div aria-busy="true" className="flex animate-pulse flex-col gap-4">
        <div className="h-9 w-2/3 rounded-md bg-fd-muted" />
        <div className="h-5 w-1/2 rounded-md bg-fd-muted" />
        <div className="mt-4 h-40 rounded-md bg-fd-muted" />
      </div>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = source.getPage((await params).slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
