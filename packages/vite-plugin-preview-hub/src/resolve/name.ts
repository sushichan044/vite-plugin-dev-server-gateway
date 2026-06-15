import { NAME_PATTERN } from "../constants";
import { InvalidNameError } from "../errors";

/**
 * Turn an arbitrary label into a URL-safe slug: lowercase, non-alphanumeric runs collapsed to a
 * single `-`, with leading/trailing dashes trimmed.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolve the final preview name.
 *
 * An explicit name wins and is validated verbatim (it becomes the URL slug). Otherwise the strategy
 * label is slugified. Throws {@link InvalidNameError} when the result is not a valid slug.
 */
export function deriveName(explicit: string | undefined, label: string): string {
  if (explicit !== undefined) {
    if (!NAME_PATTERN.test(explicit)) {
      throw new InvalidNameError(explicit);
    }
    return explicit;
  }

  const slug = slugify(label);
  if (slug === "") {
    throw new InvalidNameError(label);
  }
  return slug;
}
