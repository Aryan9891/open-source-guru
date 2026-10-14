import { loader, multiple } from "fumadocs-core/source";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import { ROUTES } from "./constants";
import { openapi } from "./openapi";

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: pageSchema },
  meta: { schema: metaSchema },
});

export const source = loader(
  multiple({
    docs: docs.toFumadocsSource(),
    // API reference: one page per endpoint, grouped by tag, named after its summary.
    openapi: await openapi.staticSource({
      baseDir: "api/reference",
      groupBy: "tag",
      name: ({ info }: { info: { title: string } }) => slugify(info.title),
      meta: true,
    }),
  }),
  { baseUrl: ROUTES.docs, plugins: [openapi.loaderPlugin()] },
);
