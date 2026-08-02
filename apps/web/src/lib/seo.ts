// Meta descriptions cap around 160 chars in search snippets; cut at a word
// boundary so the tail never ends mid-word. Some skill summaries carry readme
// HTML, so tags are stripped first.
export function metaDescription(text: string, max = 160): string {
	const clean = text
		.replace(/<[^>]*>/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
	if (clean.length <= max) return clean;
	const cut = clean.slice(0, max - 3);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}
