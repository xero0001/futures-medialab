export function splitDeliverable(value: string) {
  const [title = "", ...lines] = value.trim().split(/\r\n|[\r\n]/);
  return { title, description: lines.join("\n").trim() };
}

export function visibleProposalSummary(summary: string, terms = "") {
  const paragraphs = summary.trim().replace(/\r\n?/g, "\n").split(/\n[ \t]*\n+/);
  const fullTerms = `\n${terms.trim().replace(/\r\n?/g, "\n")}\n`;
  return paragraphs
    .filter((paragraph, index) => index === 0 || !fullTerms.includes(`\n${paragraph}\n`))
    .join("\n\n");
}

export function proposalChangeNote(changeSummary: string, hasPreviousVersion: boolean) {
  return hasPreviousVersion ? changeSummary.trim() : "";
}
