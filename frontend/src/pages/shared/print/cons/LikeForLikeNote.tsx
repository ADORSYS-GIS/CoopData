import type { Analysis } from "@/pages/shared/print/cons/analysis";
import { tr } from "@/pages/shared/print/tpl/i18n";

/**
 * Says which cooperatives the changes on the prior year compare, when some
 * have figures for only one of the two years.
 */
export const LikeForLikeNote = ({ a }: { a: Analysis }) => {
  const { added, missing, now } = a.likeForLike;
  if (!a.prior || (added.length === 0 && missing.length === 0)) return null;
  const year = a.input.year;
  return (
    <p className="small muted">
      {tr("cons.like_for_like.compared", { count: now.length, year, prior: year - 1 })}
      {added.length > 0 &&
        ` ${tr("cons.like_for_like.added", { names: added.join(", "), prior: year - 1 })}`}
      {missing.length > 0 &&
        ` ${tr("cons.like_for_like.missing", { names: missing.join(", "), year })}`}
    </p>
  );
};
