import { Parser } from "./spParser";
import { positiveRange } from "./utils";
import { URI } from "vscode-uri";
import { CompletionItemKind, Location, Position, Range } from "vscode";
import { SPItem } from "../Backend/Items/spItems";

function isInComment(commentsRanges: Range[], matchPosition: Position) {
  return commentsRanges.find((e) => e.contains(matchPosition)) !== undefined;
}

export function handleReferenceInParser(
  this: {
    parser: Parser;
    offset: number;
    previousItems: SPItem[];
    line: string;
  },
  match: RegExpExecArray
) {
  let matchPosition = new Position(this.parser.lineNb, match.index + 1);
  // Return early if we match in a comment.
  if (isInComment(this.parser.commentsRanges, matchPosition)) {
    return;
  }
  if (match[0] === "this") {
    let item = this.parser.items.find(
      (e) =>
        [CompletionItemKind.Struct, CompletionItemKind.Class].includes(
          e.kind
        ) &&
        this.parser.file == e.filePath &&
        e.fullRange.contains(matchPosition)
    );
    if (item !== undefined) {
      this.previousItems.push(item);
    }
    return;
  }
  let item = this.parser.referencesMap.get(match[0]);

  if (item !== undefined) {
    const range = positiveRange(
      this.parser.lineNb,
      match.index + this.offset,
      match.index + match[0].length + this.offset
    );

    // Prevent double references.
    if (item.range.isEqual(range)) {
      return;
    }
    const location = new Location(URI.file(this.parser.file), range);
    item.references.push(location);
    this.previousItems.push(item);
  } else if (
    match.index > 0 &&
    this.previousItems.length > 0 &&
    [".", ":"].includes(this.line[match.index - 1])
  ) {
    let parent = this.previousItems[this.previousItems.length - 1];

    let item = this.parser.methodsAndProperties.find(
      (e) =>
        [CompletionItemKind.Property, CompletionItemKind.Method].includes(
          e.kind
        ) &&
        e.name === match[0] &&
        (e.parent === parent.type || e.parent === parent.name)
    );

    if (item !== undefined) {
      const range = positiveRange(
        this.parser.lineNb,
        match.index + this.offset,
        match.index + match[0].length + this.offset
      );
      if (item.range.isEqual(range)) {
        return;
      }
      const location = new Location(URI.file(this.parser.file), range);
      item.references.push(location);
      this.previousItems.push(item);
    }
  }
}
