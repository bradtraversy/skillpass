import { badgeMarkdown, badgeUrl } from '../../lib/badge';
import CopyBox from '../ui/CopyBox';

export default function BadgeSnippet({ slug }: { slug: string }) {
	return (
		<div className="rounded-md border border-border bg-surface p-[14px]">
			<div className="flex items-center gap-3">
				<img src={badgeUrl(slug)} alt="SkillPass badge" height={20} className="flex-none" />
				<CopyBox value={badgeMarkdown(slug)} label="Copy badge markdown" />
			</div>
			<p className="mt-[10px] text-[12px] text-faint">
				Paste it into your README. It shows the latest published version's validation status and risk level and links
				back here.
			</p>
		</div>
	);
}
