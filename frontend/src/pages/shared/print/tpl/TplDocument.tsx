import { Fragment, type ReactNode } from "react";

import { useGotenbergReady } from "@/hooks/print/useGotenbergReady";
import { FrontMatter, TplCover, type TocEntry } from "@/pages/shared/print/tpl/TplChrome";
import { TplPage, type RunningFrame } from "@/pages/shared/print/tpl/TplPage";

export interface PageSpec {
  /** Listed in Contents when present. */
  toc?: { no: string; title: string };
  render: () => ReactNode;
}

type CoverProps = Parameters<typeof TplCover>[0];
type FrontProps = Omit<Parameters<typeof FrontMatter>[0], "toc">;

interface TplDocumentProps {
  frame: RunningFrame;
  cover: CoverProps;
  front: FrontProps;
  pages: PageSpec[];
}

/** Front pages are the cover (page 1) and Document Control (page 2). */
const FIRST_CONTENT_PAGE = 3;

/**
 * Cover, Document Control with Contents, then the content pages. Page numbers
 * and the Contents page numbers are worked out from the page list, so a section
 * that grows to two pages moves everything after it.
 */
export function TplDocument({ frame, cover, front, pages }: TplDocumentProps) {
  useGotenbergReady(true);

  const total = pages.length + FIRST_CONTENT_PAGE - 1;
  const toc: TocEntry[] = pages.flatMap((spec, index) =>
    spec.toc ? [{ ...spec.toc, page: index + FIRST_CONTENT_PAGE }] : [],
  );

  return (
    <div className="tpl">
      <TplCover {...cover} />
      <TplPage frame={frame} page={2} pages={total}>
        <FrontMatter {...front} toc={toc} />
      </TplPage>
      {pages.map((spec, index) => (
        <Fragment key={index}>
          <TplPage frame={frame} page={index + FIRST_CONTENT_PAGE} pages={total}>
            {spec.render()}
          </TplPage>
        </Fragment>
      ))}
    </div>
  );
}
