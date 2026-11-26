# forks/: generated group sites (do not hand-edit)

Each folder is a contingent local group fork generated from the CA regional core by `apps/group-bootstrapper/scripts/bootstrap-group.js`:

- `index.html`: a self-contained group page. It has Organization + Event JSON-LD in `<head>`, the group's meeting info, and inherited regional and World Council news, flyers, and the Aug 2027 conference card.
- `group.json`: the validated source config
- `group.jsonld.json`: the same JSON-LD as a standalone file
- `fork.manifest.json`: generator version and input hashes. The generator only replaces folders that have this file.

To change a fork, edit its `group.json` (or the regional data and templates) and re-run the generator. CI fails if a committed fork or the regional page is stale.
