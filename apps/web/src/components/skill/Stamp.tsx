import type { ValidationStatus } from 'skill-schema';
import { VERDICT_TINT } from '../../lib/verdict';

const LABEL: Record<ValidationStatus, string> = {
	passed: 'PASS',
	warning: 'WARN',
	failed: 'FAIL',
};

// Pure presentational: renders statically in .astro files and hydrated in rows.
export default function Stamp({ verdict }: { verdict: ValidationStatus }) {
	return (
		<span
			className={`rounded-[5px] border px-[9px] py-1 font-mono text-[11px] font-bold tracking-[0.1em] ${VERDICT_TINT[verdict].all}`}
		>
			{LABEL[verdict]}
		</span>
	);
}
