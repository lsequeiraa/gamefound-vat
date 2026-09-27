// Writes the metadata `web-ext sign --amo-metadata` sends to addons.mozilla.org:
// the listing from store/amo-metadata.json plus this version's release notes.
//
//   RELEASE_NOTES="…" bun run scripts/amo-metadata.ts <output.json>
import metadata from "../store/amo-metadata.json";

const [output] = process.argv.slice(2);
if (!output) {
  console.error("usage: RELEASE_NOTES=… bun run scripts/amo-metadata.ts <output.json>");
  process.exit(2);
}

const notes = process.env.RELEASE_NOTES?.trim();
const version = notes ? { ...metadata.version, release_notes: { "en-US": notes } } : metadata.version;
await Bun.write(output, `${JSON.stringify({ ...metadata, version }, null, 2)}\n`);
