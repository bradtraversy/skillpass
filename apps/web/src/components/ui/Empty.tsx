import type { ReactNode } from 'react';

export default function Empty({ children }: { children: ReactNode }) {
	return <p className="py-[10px] text-[13px] text-muted">{children}</p>;
}
