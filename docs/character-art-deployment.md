# Managed character artwork

The existing release pipeline remains the sole production writer. Add a registered
WebP to assets/characters/ or its exact Base64 encoding as .webp.b64 (plain text;
line breaks allowed). Add the SHA-256 of the decoded WebP to manifest.json under
the filename without extension. Only one representation per key is allowed.

Keys: mascot-human (315x332), mascot-chicken (315x323), mascot-alien (315x327),
commander-human, commander-chicken, commander-alien (each 256x256).
Images must be single-frame WebP with transparent corners and opaque foreground.
Check interior transparency visually before submitting. Existing absent character
keys remain unmanaged, not deleted. Never use an arbitrary upload URL or filename.

Submit a PR with a unique GAME_VERSION and matching patch note for each production
release, since the current server's immutable artwork cache key is calculated at
startup. CI validates exact bytes, stages them with existing building/field art,
backs up changed live images, atomically uploads and verifies HTTP SHA-256 on all
selected worlds. The normal server restart refreshes the artwork cache key.
Code rollback is separate from artwork backup restore.

The Base64 option allows a text-only GitHub connector to submit a prepared image
when it can access the encoded bytes. It does not grant filesystem access to a
connector or bypass authentication. A native Git client may commit binary WebP
directly. Do not paste credentials into chat or put them in the repository.
